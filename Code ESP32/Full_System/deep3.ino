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

// ---------- CONFIGURATION SALLE (À MODIFIER) ----------
#define ROOM_NAME "roomA" // Changer selon la salle: roomA, roomB, infoA, etc.

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- NTP TIME SERVER ----------
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 3600;

// ---------- VARIABLES GLOBALES ----------
String currentRoom = ROOM_NAME;
String currentSessionId = "";
String currentGroup = "";
String currentSubject = "";
bool sessionActive = false;
unsigned long lastScheduleCheck = 0;
const unsigned long SCHEDULE_CHECK_INTERVAL = 60000; // Vérifier toutes les 60 secondes
bool attendanceInitialized = false;

// ---------- STRUCTURES ----------
struct Student
{
    String id;
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

// ---------- VÉRIFICATION DES SESSIONS ACTIVES ----------
bool checkActiveSession()
{
    if (currentRoom == "")
    {
        Serial.println("Erreur: Nom de salle non défini");
        return false;
    }

    String today = getCurrentDate();
    String sessionsPath = "/sessions/" + today + "/" + currentRoom;

    Serial.println("\n=== CHECK SESSIONS ACTIVES ===");
    Serial.print("Date: ");
    Serial.println(today);
    Serial.print("Salle: ");
    Serial.println(currentRoom);
    Serial.print("Chemin sessions: ");
    Serial.println(sessionsPath);

    if (!Firebase.getJSON(fbData, sessionsPath))
    {
        Serial.println("Pas de sessions pour cette salle aujourd'hui");
        sessionActive = false;
        attendanceInitialized = false;
        showLCD("Pas de session", "active", 0);
        return false;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    bool foundActive = false;
    String currentTime = getCurrentTime();
    int currentTimeMinutes = timeToMinutes(currentTime);

    Serial.print("Heure actuelle: ");
    Serial.println(currentTime);
    Serial.print("Minutes actuelles: ");
    Serial.println(currentTimeMinutes);

    for (size_t i = 0; i < len; i++)
    {
        json.iteratorGet(i, type, key, value);
        
        if (type != FirebaseJson::JSON_OBJECT)
            continue;
            
        String sessionPath = sessionsPath + "/" + String(i);
        
        // Obtenir le statut de la session
        String status = "";
        if (Firebase.getString(fbData, sessionPath + "/status"))
        {
            status = fbData.stringData();
            Serial.print("Session ");
            Serial.print(i);
            Serial.print(" - Status: ");
            Serial.print(status);
        }

        // Obtenir les heures de début et fin
        String startTime = "";
        String endTime = "";
        if (Firebase.getString(fbData, sessionPath + "/start"))
        {
            startTime = fbData.stringData();
            Serial.print(" | Start: ");
            Serial.print(startTime);
        }
        
        if (Firebase.getString(fbData, sessionPath + "/end"))
        {
            endTime = fbData.stringData();
            Serial.print(" | End: ");
            Serial.println(endTime);
        }

        int startMinutes = timeToMinutes(startTime);
        int endMinutes = timeToMinutes(endTime);

        // Vérifier si la session est ACTIVE ou dans l'intervalle de temps
        if (status == "ACTIVE" || status == "STARTED" || status == "RUNNING" ||
            (status == "SCHEDULED" && currentTimeMinutes >= (startMinutes - 5) && 
             currentTimeMinutes <= (endMinutes + 5)))
        {
            // Récupérer les informations de la session
            if (Firebase.getString(fbData, sessionPath + "/group"))
            {
                currentGroup = fbData.stringData();
            }
            
            if (Firebase.getString(fbData, sessionPath + "/subject"))
            {
                currentSubject = fbData.stringData();
            }
            
            if (Firebase.getString(fbData, sessionPath + "/session_id"))
            {
                currentSessionId = fbData.stringData();
            }
            else
            {
                // Générer l'ID de session si non présent
                currentSessionId = today.replace("-", "") + "_" + currentRoom + "_" + 
                                   startTime.replace(":", "") + "_" + currentGroup;
            }

            sessionActive = true;
            foundActive = true;
            attendanceInitialized = false; // Réinitialiser pour la nouvelle session

            Serial.println("\n=== SESSION ACTIVE TROUVÉE ===");
            Serial.print("Session ID: ");
            Serial.println(currentSessionId);
            Serial.print("Groupe: ");
            Serial.println(currentGroup);
            Serial.print("Matière: ");
            Serial.println(currentSubject);
            Serial.print("Heure début: ");
            Serial.println(startTime);
            Serial.print("Heure fin: ");
            Serial.println(endTime);

            // Obtenir le nom de la matière
            String subjectName = currentSubject;
            if (Firebase.getString(fbData, "/subjects/" + currentSubject + "/name"))
            {
                subjectName = fbData.stringData();
            }

            // Afficher sur LCD
            lcd.clear();
            lcd.print("Session active:");
            lcd.setCursor(0, 1);
            String displaySubject = subjectName.substring(0, 16);
            lcd.print(displaySubject);
            delay(2000);
            
            break;
        }
    }

    json.iteratorEnd();

    if (!foundActive)
    {
        Serial.println("Aucune session active trouvée");
        sessionActive = false;
        attendanceInitialized = false;
        showLCD("Pas de session", "en cours", 0);
    }

    return foundActive;
}

// ---------- INITIALISER LES ABSENCES ----------
void initializeAbsences()
{
    if (!sessionActive || currentSessionId == "" || currentGroup == "")
    {
        Serial.println("Erreur: Impossible d'initialiser les absences - session inactive");
        return;
    }

    // Vérifier si l'initialisation a déjà été faite
    String attendancePath = "/attendance/" + currentSessionId;
    if (Firebase.getJSON(fbData, attendancePath))
    {
        Serial.println("La présence a déjà été initialisée");
        attendanceInitialized = true;
        return;
    }

    Serial.println("\n=== INITIALISATION DES ABSENCES ===");
    Serial.print("Session: ");
    Serial.println(currentSessionId);
    Serial.print("Groupe: ");
    Serial.println(currentGroup);
    
    showLCD("Initialisation", "des absences...", 0);

    // Créer la structure d'attendance
    FirebaseJson attendanceJson;
    FirebaseJson presentJson; // Vide initialement
    FirebaseJson absentJson;

    // Compter les étudiants dans le groupe
    int groupStudentCount = 0;

    Serial.println("Étudiants du groupe " + currentGroup + ":");
    
    for (int i = 0; i < studentCount; i++)
    {
        if (students[i].group == currentGroup && students[i].active)
        {
            FirebaseJson studentJson;
            studentJson.set("name", students[i].name);
            absentJson.set(students[i].id, studentJson);
            groupStudentCount++;
            
            Serial.print("  - ");
            Serial.print(students[i].id);
            Serial.print(": ");
            Serial.println(students[i].name);
        }
    }

    attendanceJson.set("present", presentJson);
    attendanceJson.set("absent", absentJson);

    // Enregistrer dans Firebase
    if (Firebase.setJSON(fbData, attendancePath, attendanceJson))
    {
        Serial.print("✅ Absences initialisées pour ");
        Serial.print(groupStudentCount);
        Serial.println(" étudiants");
        attendanceInitialized = true;
        
        // Feedback sonore et visuel
        beep(200);
        delay(100);
        beep(200);
        
        showLCD("Absences init:", String(groupStudentCount) + " etudiants", 2000);
    }
    else
    {
        Serial.println("❌ Erreur lors de l'initialisation des absences");
        attendanceInitialized = false;
        showLCD("Erreur init", "absences", 2000);
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
        showLCD("Erreur", "chargement etu", 2000);
        return;
    }

    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;

    for (size_t i = 0; i < len; i++)
    {
        json.iteratorGet(i, type, key, value);

        if (type != FirebaseJson::JSON_OBJECT)
            continue;

        String studentId = key;
        String studentPath = "/students/" + studentId;

        // Vérifier si l'étudiant est actif
        bool isActive = false;
        if (Firebase.getBool(fbData, studentPath + "/active"))
        {
            isActive = fbData.boolData();
        }

        if (!isActive)
            continue;

        students[studentCount].id = studentId;

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
        Serial.print(students[studentCount].id);
        Serial.print(" - ");
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

    Serial.print("✅ Total étudiants chargés: ");
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
bool isStudentInCurrentGroup(String studentId)
{
    if (currentGroup == "")
        return false;

    for (int i = 0; i < studentCount; i++)
    {
        if (students[i].id == studentId && students[i].group == currentGroup)
        {
            return true;
        }
    }
    return false;
}

// ---------- ENREGISTRER PRÉSENCE ----------
void recordAttendance(String studentId)
{
    if (!sessionActive || currentSessionId == "" || !attendanceInitialized)
    {
        Serial.println("❌ Session non active ou présence non initialisée");
        showLCD("Erreur:", "Session inactive", 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Vérifier si l'étudiant est dans le groupe
    if (!isStudentInCurrentGroup(studentId))
    {
        Serial.println("❌ Étudiant pas dans ce groupe!");
        showLCD("Erreur:", "Mauvais groupe", 2000);
        beep(100);
        delay(100);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Chemins Firebase
    String absentPath = "/attendance/" + currentSessionId + "/absent/" + studentId;
    String presentPath = "/attendance/" + currentSessionId + "/present/" + studentId;

    // Vérifier si déjà présent
    if (Firebase.getJSON(fbData, presentPath))
    {
        Serial.println("⚠️ Déjà enregistré!");
        showLCD("Deja present!", "", 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Vérifier si dans les absents
    if (!Firebase.getJSON(fbData, absentPath))
    {
        Serial.println("❌ Étudiant non trouvé dans les absents!");
        showLCD("Erreur:", "Etudiant absent?", 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }

    // Récupérer le nom de l'étudiant
    String studentName = "";
    for (int i = 0; i < studentCount; i++)
    {
        if (students[i].id == studentId)
        {
            studentName = students[i].name;
            break;
        }
    }

    Serial.print("\n=== ENREGISTREMENT PRÉSENCE ===");
    Serial.print("\nÉtudiant: ");
    Serial.print(studentName);
    Serial.print(" (");
    Serial.print(studentId);
    Serial.println(")");

    // Créer l'objet de présence
    FirebaseJson presentJson;
    presentJson.set("name", studentName);
    presentJson.set("time", getCurrentTime());

    // Retirer des absents et ajouter aux présents
    Serial.print("Suppression de absent: ");
    Serial.println(absentPath);
    
    if (Firebase.deleteNode(fbData, absentPath))
    {
        Serial.print("Ajout à present: ");
        Serial.println(presentPath);
        
        if (Firebase.setJSON(fbData, presentPath, presentJson))
        {
            Serial.println("✅ Présence enregistrée avec succès!");
            
            // Feedback sonore
            beep(300);
            delay(200);
            beep(300);
            
            // Afficher confirmation
            lcd.clear();
            lcd.print("Present:");
            lcd.setCursor(0, 1);
            String displayName = studentName.substring(0, 16);
            lcd.print(displayName);
            
            // Mettre à jour les stats
            updateAttendanceStats();
            
            delay(2000);
        }
        else
        {
            Serial.println("❌ Erreur ajout aux présents");
            showLCD("Erreur:", "Ajout presence", 2000);
            beep(100);
        }
    }
    else
    {
        Serial.println("❌ Erreur suppression des absents");
        showLCD("Erreur:", "Suppression", 2000);
        beep(100);
    }
}

// ---------- METTRE À JOUR LES STATISTIQUES ----------
void updateAttendanceStats()
{
    if (currentSessionId == "")
        return;

    String attendancePath = "/attendance/" + currentSessionId;
    
    // Compter les présents
    int presentCount = 0;
    if (Firebase.getJSON(fbData, attendancePath + "/present"))
    {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        presentCount = len;
        json.iteratorEnd();
    }

    // Compter les absents
    int absentCount = 0;
    if (Firebase.getJSON(fbData, attendancePath + "/absent"))
    {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        absentCount = len;
        json.iteratorEnd();
    }

    int totalStudents = presentCount + absentCount;

    Serial.print("📊 Stats: ");
    Serial.print(presentCount);
    Serial.print("/");
    Serial.println(totalStudents);
    
    // Afficher les stats sur LCD
    lcd.clear();
    lcd.print("Stats: ");
    lcd.print(presentCount);
    lcd.print("/");
    lcd.print(totalStudents);
    lcd.setCursor(0, 1);
    lcd.print("Present/Absent");
    delay(1000);
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
    
    // Afficher la salle configurée
    Serial.println("=================================");
    Serial.println("SYSTEME DE PRESENCE AUTOMATIQUE");
    Serial.print("Salle configuree: ");
    Serial.println(ROOM_NAME);
    Serial.println("=================================");
    
    showLCD("Salle:", ROOM_NAME, 1500);

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

    Serial.println("✅ AS608 détecté");
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
        Serial.println("\n❌ Erreur WiFi!");
        showLCD("Erreur WiFi", "Verifiez config", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("\n✅ WiFi connecté!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    showLCD("WiFi OK", WiFi.localIP().toString(), 1500);

    // Configuration de l'heure
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
    delay(2000);

    Serial.print("📅 Date/Heure: ");
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
        Serial.println("❌ Erreur Firebase!");
        showLCD("Erreur Firebase", "", 0);
        while (1)
        {
            beep(100);
            delay(1000);
        }
    }

    Serial.println("✅ Firebase connecté!");
    showLCD("Firebase OK", "", 1500);
    beep(200);

    // Charger les étudiants
    loadStudents();

    // Vérifier la session active
    checkActiveSession();

    showLCD("Pret a scanner", "Posez le doigt", 0);
    beep(200);
}

// ---------- LOOP ----------
void loop()
{
    // Vérifier la session active périodiquement
    if (millis() - lastScheduleCheck > SCHEDULE_CHECK_INTERVAL)
    {
        Serial.println("\n=== VÉRIFICATION PÉRIODIQUE ===");
        checkActiveSession();
        lastScheduleCheck = millis();
    }

    // Si pas de session active, attendre
    if (!sessionActive)
    {
        // Afficher un message toutes les 10 secondes
        static unsigned long lastDisplay = 0;
        if (millis() - lastDisplay > 10000)
        {
            showLCD("En attente", "de session...", 0);
            lastDisplay = millis();
        }
        delay(1000);
        return;
    }

    // Initialiser les absences si pas encore fait
    if (!attendanceInitialized)
    {
        initializeAbsences();
        if (attendanceInitialized)
        {
            showLCD("Pret a scanner", "Posez le doigt", 0);
        }
        else
        {
            showLCD("Erreur init", "Reessayer...", 1000);
        }
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
            Serial.println("❌ Erreur conversion image");
            return;
        }

        result = finger.fingerFastSearch();

        if (result == FINGERPRINT_OK)
        {
            int foundId = finger.fingerID;
            int confidence = finger.confidence;

            Serial.println("\n=== EMPREINTE RECONNUE ===");
            Serial.print("ID Empreinte: ");
            Serial.print(foundId);
            Serial.print(" | Confiance: ");
            Serial.println(confidence);

            // Trouver l'étudiant
            Student *student = findStudentByFingerprint(foundId);

            if (student != nullptr)
            {
                Serial.print("✅ Étudiant trouvé: ");
                Serial.print(student->name);
                Serial.print(" (ID: ");
                Serial.print(student->id);
                Serial.print(" | Groupe: ");
                Serial.print(student->group);
                Serial.println(")");

                showLCD("Bonjour", student->name, 1500);

                // Enregistrer la présence
                recordAttendance(student->id);

                delay(1000);
                showLCD("Pret a scanner", "Posez le doigt", 0);
            }
            else
            {
                Serial.println("❌ Étudiant non trouvé");
                showLCD("Empreinte", "non assignee", 2000);
                beep(100);
                delay(100);
                beep(100);
                showLCD("Pret a scanner", "Posez le doigt", 0);
            }
        }
        else if (result == FINGERPRINT_NOTFOUND)
        {
            Serial.println("⚠️ Empreinte non reconnue");
            showLCD("Non reconnu", "Essayez encore", 2000);
            beep(100);
            delay(100);
            beep(100);
            showLCD("Pret a scanner", "Posez le doigt", 0);
        }
    }

    delay(100);
}