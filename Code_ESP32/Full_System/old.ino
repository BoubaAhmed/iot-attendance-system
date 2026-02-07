#include <LiquidCrystal.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <time.h>

// ---------- LCD ----------
LiquidCrystal lcd(21, 22, 18, 19, 23, 5);

// ---------- BUZZER ----------
#define BUZZER_PIN 27

// ---------- FINGERPRINT ----------
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger(&mySerial);

// ---------- WIFI & FIREBASE ----------
#define WIFI_SSID "inwi Home 4G9399CB"
#define WIFI_PASSWORD "38879322"
#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "Ton api key ici" // Clé API Firebase

// ---------- ESP32 ID (À MODIFIER SELON VOTRE ESP32) ----------
#define ESP32_ID "ESP32_A" // Changez en "ESP32_B" pour l'autre salle
#define Room

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- NTP TIME SERVER ----------
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 3600;

// ---------- VARIABLES GLOBALES ----------
String currentRoom = "";
String currentSessionId = "";
String currentGroup = "";
String currentSubject = "";
bool sessionActive = false;
unsigned long lastScheduleCheck = 0;
const unsigned long SCHEDULE_CHECK_INTERVAL = 60000; // Vérifier toutes les 60 secondes

// ---------- STRUCTURES ----------
struct Student
{
    int id;
    String name;
    int fingerprintId;
    String group;
    bool active;
};

Student students[50];
int studentCount = 0;

// ---------- FONCTIONS UTILITAIRES ----------

void beep(int t)
{
    digitalWrite(BUZZER_PIN, HIGH);
    delay(t);
    digitalWrite(BUZZER_PIN, LOW);
}

void showLCD(String line1, String line2 = "", int delayMs = 0)
{
    lcd.clear();
    lcd.print(line1);
    if (line2.length() > 0)
    {
        lcd.setCursor(0, 1);
        lcd.print(line2);
    }
    if (delayMs > 0)
        delay(delayMs);
}

String getCurrentDate()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        return "2025-01-15"; // Date par défaut en cas d'erreur
    }
    char dateStr[11];
    strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", &timeinfo);
    return String(dateStr);
}

String getCurrentTime()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        return "00:00";
    }
    char timeStr[6];
    strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
    return String(timeStr);
}

String getCurrentDay()
{
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo))
    {
        return "monday";
    }

    const char *days[] = {"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"};
    return String(days[timeinfo.tm_wday]);
}

// Convertir temps en minutes pour comparaison
int timeToMinutes(String timeStr)
{
    int hours = timeStr.substring(0, 2).toInt();
    int minutes = timeStr.substring(3, 5).toInt();
    return hours * 60 + minutes;
}

// ---------- DÉTECTION DE LA SALLE ----------
bool detectRoom()
{
    Serial.println("\n=== DÉTECTION DE LA SALLE ===");
    showLCD("Detection", "salle...", 0);

    if (!Firebase.ready())
    {
        Serial.println("Firebase non connecté");
        return false;
    }

    // Parcourir toutes les salles
    if (Firebase.getJSON(fbData, "/rooms"))
    {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        String key, value;
        int type = 0;

        for (size_t i = 0; i < len; i++)
        {
            json.iteratorGet(i, type, key, value);

            // Vérifier l'ESP32_ID de cette salle
            String espIdPath = "/rooms/" + key + "/esp32_id";
            if (Firebase.getString(fbData, espIdPath))
            {
                if (fbData.stringData() == ESP32_ID)
                {
                    currentRoom = key;

                    // Récupérer le nom de la salle
                    String roomNamePath = "/rooms/" + key + "/name";
                    String roomName = "";
                    if (Firebase.getString(fbData, roomNamePath))
                    {
                        roomName = fbData.stringData();
                    }

                    Serial.print("Salle détectée: ");
                    Serial.print(currentRoom);
                    Serial.print(" (");
                    Serial.print(roomName);
                    Serial.println(")");

                    showLCD("Salle:", roomName, 2000);
                    json.iteratorEnd();
                    return true;
                }
            }
        }
        json.iteratorEnd();
    }

    Serial.println("Salle non trouvée pour cet ESP32_ID");
    showLCD("Erreur:", "Salle inconnue", 2000);
    return false;
}

// ---------- VÉRIFICATION DES SESSIONS GÉRÉES PAR LE BACKEND ----------
bool checkSchedule()
{
    // New behavior: sessions are managed by the backend (APScheduler).
    // We only check /sessions/<date>/<room> for any session and its status.
    if (currentRoom == "")
    {
        return false;
    }

    String today = getCurrentDate();
    String sessionsPath = "/sessions/" + today;

    Serial.println("\n=== CHECK SESSIONS (backend-managed) ===");
    Serial.print("Checking: ");
    Serial.println(sessionsPath + "/" + currentRoom);

    // Ensure there are sessions for today
    if (!Firebase.getJSON(fbData, sessionsPath))
    {
        Serial.println("No sessions for today");
        sessionActive = false;
        showLCD("Pas de session", "aujourd'hui", 0);
        return false;
    }

    // Get sessions for this room only
    String roomPath = sessionsPath + "/" + currentRoom;
    if (!Firebase.getJSON(fbData, roomPath))
    {
        Serial.println("No sessions for this room today");
        sessionActive = false;
        showLCD("Pas de cours", "aujourd'hui", 0);
        return false;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    bool foundActive = false;

    for (size_t i = 0; i < len; i++)
    {
        json.iteratorGet(i, type, key, value); // key is session id, e.g. "16:00_18:00"
        String sessionPath = roomPath + "/" + key;

        String status = "";
        if (Firebase.getString(fbData, sessionPath + "/status"))
        {
            status = fbData.stringData();
            status.toUpperCase();
        }

        // Consider these statuses as active / taking attendance
        if (status == "OPEN" || status == "ACTIVE" || status == "STARTED" || status == "RUNNING")
        {
            // Read group and subject
            if (Firebase.getString(fbData, sessionPath + "/group"))
            {
                currentGroup = fbData.stringData();
            }
            if (Firebase.getString(fbData, sessionPath + "/subject"))
            {
                currentSubject = fbData.stringData();
            }

            // Build session id used for attendance path (keep previous format)
            currentSessionId = today + "_" + currentRoom + "_" + key;
            sessionActive = true;
            foundActive = true;

            String subjectName = currentSubject;
            if (Firebase.getString(fbData, "/subjects/" + currentSubject + "/name"))
            {
                subjectName = fbData.stringData();
            }

            Serial.print("Active session found: ");
            Serial.println(sessionPath);
            showLCD("Session active", subjectName, 2000);
            break;
        }
    }

    json.iteratorEnd();

    if (!foundActive)
    {
        Serial.println("No active session currently");
        sessionActive = false;
        showLCD("Pas de cours", "en ce moment", 0);
    }

    return foundActive;
}

// ---------- CRÉATION DE SESSION ----------
void createSession(String startTime, String endTime)
{
    String sessionPath = "/sessions/" + currentSessionId;

    // Vérifier si la session existe déjà
    if (Firebase.getString(fbData, sessionPath + "/status"))
    {
        Serial.println("Session déjà existante");
        return;
    }

    Serial.println("Création de la nouvelle session...");

    // Créer la session
    FirebaseJson json;
    json.set("date", getCurrentDate());
    json.set("room", currentRoom);
    json.set("start", startTime);
    json.set("end", endTime);
    json.set("group", currentGroup);
    json.set("subject", currentSubject);
    json.set("status", "OPEN");

    // Compter les étudiants du groupe
    int totalStudents = 0;
    String groupPath = "/groups/" + currentGroup + "/students";
    if (Firebase.getJSON(fbData, groupPath))
    {
        FirebaseJson &studentsJson = fbData.jsonObject();
        size_t len = studentsJson.iteratorBegin();
        totalStudents = len;
        studentsJson.iteratorEnd();
    }

    FirebaseJson stats;
    stats.set("total", totalStudents);
    stats.set("present", 0);
    stats.set("absent", totalStudents);
    json.set("stats", stats);

    if (Firebase.setJSON(fbData, sessionPath, json))
    {
        Serial.println("Session créée avec succès!");
        beep(200);
    }
    else
    {
        Serial.println("Erreur création session");
    }
}

// ---------- CHARGER LES ÉTUDIANTS ----------
void loadStudents()
{
    Serial.println("\n=== CHARGEMENT ÉTUDIANTS ===");
    showLCD("Chargement", "etudiants...", 0);

    studentCount = 0;

    if (!Firebase.getJSON(fbData, "/students"))
    {
        Serial.println("Erreur chargement étudiants");
        return;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    for (size_t i = 0; i < len; i++)
    {
        json.iteratorGet(i, type, key, value);

        int studentId = i; // Index dans le tableau
        String studentPath = "/students/" + String(i);

        // Vérifier si l'étudiant est actif
        bool isActive = false;
        if (Firebase.getBool(fbData, studentPath + "/active"))
        {
            isActive = fbData.boolData();
        }

        if (!isActive)
            continue;

        students[studentCount].id = i;

        if (Firebase.getString(fbData, studentPath + "/name"))
        {
            students[studentCount].name = fbData.stringData();
        }

        if (Firebase.getInt(fbData, studentPath + "/fingerprint_id"))
        {
            students[studentCount].fingerprintId = fbData.intData();
        }

        if (Firebase.getString(fbData, studentPath + "/group"))
        {
            students[studentCount].group = fbData.stringData();
        }

        students[studentCount].active = isActive;

        Serial.print("Étudiant ");
        Serial.print(studentCount);
        Serial.print(": ");
        Serial.print(students[studentCount].name);
        Serial.print(" | Empreinte: ");
        Serial.print(students[studentCount].fingerprintId);
        Serial.print(" | Groupe: ");
        Serial.println(students[studentCount].group);

        studentCount++;

        if (studentCount >= 50)
            break;
    }

    json.iteratorEnd();

    Serial.print("Total étudiants chargés: ");
    Serial.println(studentCount);
    showLCD("Etudiants:", String(studentCount), 1500);
}

// ---------- TROUVER ÉTUDIANT PAR EMPREINTE ----------
Student *findStudentByFingerprint(int fingerprintId)
{
    for (int i = 0; i < studentCount; i++)
    {
        if (students[i].fingerprintId == fingerprintId && students[i].active)
        {
            return &students[i];
        }
    }
    return nullptr;
}

// ---------- VÉRIFIER SI ÉTUDIANT EST DANS LE GROUPE ----------
bool isStudentInCurrentGroup(int studentId)
{
    if (currentGroup == "")
        return false;

    String groupStudentsPath = "/groups/" + currentGroup + "/students/" + String(studentId);

    if (Firebase.getBool(fbData, groupStudentsPath))
    {
        return fbData.boolData();
    }

    return false;
}

// ---------- ENREGISTRER PRÉSENCE ----------
void recordAttendance(int studentId)
{
    if (!sessionActive || currentSessionId == "")
    {
        Serial.println("Aucune session active");
        showLCD("Erreur:", "Pas de session", 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Vérifier si l'étudiant est dans le groupe
    if (!isStudentInCurrentGroup(studentId))
    {
        Serial.println("Étudiant pas dans ce groupe!");
        showLCD("Erreur:", "Mauvais groupe", 2000);
        beep(100);
        delay(100);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Vérifier si déjà présent
    String attendancePath = "/attendance/" + currentSessionId + "/" + String(studentId);
    if (Firebase.getString(fbData, attendancePath + "/status"))
    {
        if (fbData.stringData() == "PRESENT")
        {
            Serial.println("Déjà enregistré!");
            showLCD("Deja present!", "", 2000);
            beep(100);
            delay(100);
            beep(100);
            return;
        }
    }

    // Enregistrer la présence
    FirebaseJson json;
    json.set("status", "PRESENT");
    json.set("time", getCurrentTime());

    if (Firebase.setJSON(fbData, attendancePath, json))
    {
        Serial.println("Présence enregistrée!");

        // Mettre à jour les statistiques
        updateSessionStats();

        beep(300);
    }
    else
    {
        Serial.println("Erreur enregistrement présence");
        showLCD("Erreur:", "Enregistrement", 2000);
        beep(100);
        delay(100);
        beep(100);
    }
}

// ---------- METTRE À JOUR STATISTIQUES ----------
void updateSessionStats()
{
    String sessionPath = "/sessions/" + currentSessionId;

    // Compter les présents
    String attendancePath = "/attendance/" + currentSessionId;
    int presentCount = 0;

    if (Firebase.getJSON(fbData, attendancePath))
    {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        presentCount = len;
        json.iteratorEnd();
    }

    // Récupérer le total
    int totalStudents = 0;
    if (Firebase.getInt(fbData, sessionPath + "/stats/total"))
    {
        totalStudents = fbData.intData();
    }

    // Mettre à jour
    Firebase.setInt(fbData, sessionPath + "/stats/present", presentCount);
    Firebase.setInt(fbData, sessionPath + "/stats/absent", totalStudents - presentCount);

    Serial.print("Stats mises à jour: ");
    Serial.print(presentCount);
    Serial.print("/");
    Serial.println(totalStudents);
}

// ---------- SETUP ----------
void setup()
{
    Serial.begin(115200);
    delay(1000);

    pinMode(BUZZER_PIN, OUTPUT);

    // LCD
    lcd.begin(16, 2);
    showLCD("Systeme", "Presence Auto", 2000);

    // Capteur empreinte
    mySerial.begin(57600, SERIAL_8N1, 16, 17);
    finger.begin(57600);
    delay(1000);

    if (!finger.verifyPassword())
    {
        showLCD("ERREUR", "Capteur AS608", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("AS608 détecté");
    showLCD("AS608 OK", "", 1500);
    beep(200);

    // WiFi
    showLCD("Connexion WiFi", "", 0);
    Serial.print("Connexion WiFi ");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        Serial.print(".");
        delay(500);
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("\nErreur WiFi!");
        showLCD("Erreur WiFi", "Verifiez config", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("\nWiFi connecté!");
    showLCD("WiFi OK", "", 1500);

    // Configuration de l'heure
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    delay(2000);

    Serial.print("Date/Heure: ");
    Serial.print(getCurrentDate());
    Serial.print(" ");
    Serial.println(getCurrentTime());

    // Firebase
    fbConfig.host = FIREBASE_HOST;
    fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;

    Firebase.begin(&fbConfig, &fbAuth);
    Firebase.reconnectWiFi(true);
    delay(2000);

    if (!Firebase.ready())
    {
        Serial.println("Erreur Firebase!");
        showLCD("Erreur Firebase", "", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("Firebase connecté!");
    showLCD("Firebase OK", "", 1500);
    beep(200);

    // Détection de la salle
    if (!detectRoom())
    {
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    // Charger les étudiants
    loadStudents();

    // Vérifier le schedule
    checkSchedule();

    showLCD("Pret a scanner", "Posez le doigt", 0);
    beep(200);
}

// ---------- LOOP ----------
void loop()
{
    // Vérifier le schedule périodiquement
    if (millis() - lastScheduleCheck > SCHEDULE_CHECK_INTERVAL)
    {
        checkSchedule();
        lastScheduleCheck = millis();
    }

    // Si pas de session active, attendre
    if (!sessionActive)
    {
        delay(1000);
        return;
    }

    // Vérifier si un doigt est présent
    int result = finger.getImage();

    if (result == FINGERPRINT_OK)
    {
        result = finger.image2Tz();
        if (result != FINGERPRINT_OK)
        {
            Serial.println("Erreur conversion image");
            return;
        }

        result = finger.fingerFastSearch();

        if (result == FINGERPRINT_OK)
        {
            int foundId = finger.fingerID;
            int confidence = finger.confidence;

            Serial.print("\n=== EMPREINTE RECONNUE ===");
            Serial.print("\nID Empreinte: ");
            Serial.print(foundId);
            Serial.print("\nConfiance: ");
            Serial.println(confidence);

            // Trouver l'étudiant
            Student *student = findStudentByFingerprint(foundId);

            if (student != nullptr)
            {
                Serial.print("Étudiant: ");
                Serial.print(student->name);
                Serial.print(" (Groupe: ");
                Serial.print(student->group);
                Serial.println(")");

                showLCD("Bonjour", student->name, 1500);

                // Enregistrer la présence
                recordAttendance(student->id);

                if (isStudentInCurrentGroup(student->id))
                {
                    showLCD("Presence OK", student->name, 2000);
                }
            }
            else
            {
                Serial.println("Étudiant non trouvé");
                showLCD("Empreinte", "non assignee", 2000);
                beep(100);
                delay(100);
                beep(100);
            }

            delay(1000);
            showLCD("Pret a scanner", "Posez le doigt", 0);
        }
        else if (result == FINGERPRINT_NOTFOUND)
        {
            Serial.println("Empreinte non reconnue");
            showLCD("Non reconnu", "Essayez encore", 2000);
            beep(100);
            delay(100);
            beep(100);
            showLCD("Pret a scanner", "Posez le doigt", 0);
        }
    }

    delay(100);
}
