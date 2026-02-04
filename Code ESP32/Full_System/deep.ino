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
#define WIFI_SSID "Readme 9T"
#define WIFI_PASSWORD "123456789"
#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyCiQkuIHnCFbAxfhxMpdVfk0PymoYkY66g" // Clé API Firebase

// ---------- ESP32 ID (À MODIFIER SELON VOTRE ESP32) ----------
#define ESP32_ID "ESP32_A"  // Changez en "ESP32_B" pour l'autre salle

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- NTP TIME SERVER ----------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 3600;

// ---------- VARIABLES GLOBALES ----------
String currentRoom = "";
String currentSessionPath = ""; // Format: "2026-01-31/roomA/16:00_18:00"
String currentGroup = "";
String currentSubject = "";
String currentSubjectName = "";
bool sessionActive = false;
unsigned long lastSessionCheck = 0;
const unsigned long SESSION_CHECK_INTERVAL = 30000; // Vérifier toutes les 30 secondes

// ---------- STRUCTURES ----------
struct Student {
    String id; // ID Firebase (ex: "S1", "S2")
    String name;
    int fingerprintId;
    String group;
    bool active;
};

Student students[50];
int studentCount = 0;

// ---------- FONCTIONS UTILITAIRES ----------

void beep(int t) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(t);
    digitalWrite(BUZZER_PIN, LOW);
}

void showLCD(String line1, String line2 = "", int delayMs = 0) {
    lcd.clear();
    lcd.print(line1);
    if (line2.length() > 0) {
        lcd.setCursor(0, 1);
        lcd.print(line2);
    }
    if (delayMs > 0)
        delay(delayMs);
}

String getCurrentDate() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return "2026-02-05"; // Date par défaut en cas d'erreur
    }
    char dateStr[11];
    strftime(dateStr, sizeof(dateStr), "%Y-%m-%d", &timeinfo);
    return String(dateStr);
}

String getCurrentTime() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return "00:00";
    }
    char timeStr[6];
    strftime(timeStr, sizeof(timeStr), "%H:%M", &timeinfo);
    return String(timeStr);
}

String getCurrentDay() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return "monday";
    }
    
    const char* days[] = {"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"};
    return String(days[timeinfo.tm_wday]);
}

// Convertir temps en minutes pour comparaison
int timeToMinutes(String timeStr) {
    if (timeStr.length() < 5) return 0;
    int hours = timeStr.substring(0, 2).toInt();
    int minutes = timeStr.substring(3, 5).toInt();
    return hours * 60 + minutes;
}

// ---------- DÉTECTION DE LA SALLE ----------
bool detectRoom() {
    Serial.println("\n=== DÉTECTION DE LA SALLE ===");
    showLCD("Detection", "salle...", 0);
    
    if (!Firebase.ready()) {
        Serial.println("Firebase non connecté");
        return false;
    }
    
    // Parcourir toutes les salles
    if (Firebase.getJSON(fbData, "/rooms")) {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        String key, value;
        int type = 0;
        
        for (size_t i = 0; i < len; i++) {
            json.iteratorGet(i, type, key, value);
            
            // Vérifier l'ESP32_ID de cette salle
            String espIdPath = "/rooms/" + key + "/esp32_id";
            if (Firebase.getString(fbData, espIdPath)) {
                if (fbData.stringData() == ESP32_ID) {
                    currentRoom = key;
                    
                    // Récupérer le nom de la salle
                    String roomNamePath = "/rooms/" + key + "/name";
                    String roomName = "";
                    if (Firebase.getString(fbData, roomNamePath)) {
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

// ---------- VÉRIFIER SESSION ACTIVE ----------
bool checkActiveSession() {
    if (currentRoom == "") {
        return false;
    }
    
    String today = getCurrentDate();
    String currentTime = getCurrentTime();
    int currentMinutes = timeToMinutes(currentTime);
    
    Serial.println("\n=== VÉRIFICATION SESSION ACTIVE ===");
    Serial.print("Date: ");
    Serial.print(today);
    Serial.print(" | Heure: ");
    Serial.println(currentTime);
    
    // Vérifier si des sessions existent pour aujourd'hui
    String sessionsPath = "/sessions/" + today;
    if (!Firebase.getJSON(fbData, sessionsPath)) {
        Serial.println("Pas de sessions pour aujourd'hui");
        sessionActive = false;
        showLCD("Pas de session", "aujourd'hui", 2000);
        return false;
    }
    
    // Vérifier les sessions pour cette salle
    String roomSessionsPath = sessionsPath + "/" + currentRoom;
    if (!Firebase.getJSON(fbData, roomSessionsPath)) {
        Serial.println("Pas de session pour cette salle aujourd'hui");
        sessionActive = false;
        showLCD("Pas de session", "cette salle", 2000);
        return false;
    }
    
    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;
    
    bool foundSession = false;
    
    for (size_t i = 0; i < len; i++) {
        json.iteratorGet(i, type, key, value);
        
        // key format: "16:00_18:00"
        int separatorPos = key.indexOf('_');
        if (separatorPos == -1) continue;
        
        String startTime = key.substring(0, separatorPos);
        String endTime = key.substring(separatorPos + 1);
        
        int startMinutes = timeToMinutes(startTime);
        int endMinutes = timeToMinutes(endTime);
        
        // Vérifier si nous sommes dans ce créneau horaire
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            Serial.print("Session trouvée: ");
            Serial.println(key);
            
            // Construire le chemin complet de la session
            currentSessionPath = today + "/" + currentRoom + "/" + key;
            
            // Récupérer les détails de la session
            String sessionPath = roomSessionsPath + "/" + key;
            
            if (Firebase.getJSON(fbData, sessionPath)) {
                FirebaseJson &sessionJson = fbData.jsonObject();
                
                // Récupérer les informations de la session
                String status = "";
                if (sessionJson.get("status", status)) {
                    // Si la session est SCHEDULED, la passer en ACTIVE
                    if (status == "SCHEDULED") {
                        sessionJson.set("status", "ACTIVE");
                        sessionJson.set("started_at", getCurrentTime());
                        Firebase.setJSON(fbData, sessionPath, sessionJson);
                        Serial.println("Session passée en ACTIVE");
                        beep(200);
                    }
                    
                    // Récupérer les autres informations
                    sessionJson.get("group", currentGroup);
                    sessionJson.get("subject", currentSubject);
                    
                    // Récupérer le nom de la matière
                    currentSubjectName = currentSubject;
                    if (Firebase.getString(fbData, "/subjects/" + currentSubject + "/name")) {
                        currentSubjectName = fbData.stringData();
                    }
                    
                    sessionActive = true;
                    foundSession = true;
                    
                    Serial.print("Session ID: ");
                    Serial.println(currentSessionPath);
                    Serial.print("Groupe: ");
                    Serial.println(currentGroup);
                    Serial.print("Matière: ");
                    Serial.println(currentSubjectName);
                    Serial.print("Statut: ");
                    Serial.println(status);
                    
                    // Afficher la matière sur LCD
                    showLCD("Session active", currentSubjectName, 2000);
                    break;
                }
            }
        }
    }
    
    json.iteratorEnd();
    
    if (!foundSession) {
        Serial.println("Pas de session active en ce moment");
        sessionActive = false;
        
        // Vérifier s'il y aura une session plus tard aujourd'hui
        bool hasFutureSession = false;
        if (Firebase.getJSON(fbData, roomSessionsPath)) {
            FirebaseJson &futureJson = fbData.jsonObject();
            size_t futureLen = futureJson.iteratorBegin();
            
            for (size_t i = 0; i < futureLen; i++) {
                futureJson.iteratorGet(i, type, key, value);
                int separatorPos = key.indexOf('_');
                if (separatorPos == -1) continue;
                
                String startTime = key.substring(0, separatorPos);
                int startMinutes = timeToMinutes(startTime);
                
                if (currentMinutes < startMinutes) {
                    hasFutureSession = true;
                    
                    // Récupérer les détails de la prochaine session
                    String nextSessionPath = roomSessionsPath + "/" + key;
                    if (Firebase.getJSON(fbData, nextSessionPath)) {
                        FirebaseJson &nextSession = fbData.jsonObject();
                        String nextSubject = "";
                        nextSession.get("subject", nextSubject);
                        
                        // Récupérer le nom de la matière
                        String nextSubjectName = nextSubject;
                        if (Firebase.getString(fbData, "/subjects/" + nextSubject + "/name")) {
                            nextSubjectName = fbData.stringData();
                        }
                        
                        showLCD("Prochaine:", nextSubjectName, 2000);
                        showLCD("A " + startTime, "Groupe " + currentGroup, 2000);
                    }
                    break;
                }
            }
            futureJson.iteratorEnd();
        }
        
        if (!hasFutureSession) {
            showLCD("Pas de session", "aujourd'hui", 2000);
        }
    }
    
    return foundSession;
}

// ---------- CHARGER LES ÉTUDIANTS ----------
void loadStudents() {
    Serial.println("\n=== CHARGEMENT ÉTUDIANTS ===");
    showLCD("Chargement", "etudiants...", 0);
    
    studentCount = 0;
    
    if (!Firebase.getJSON(fbData, "/students")) {
        Serial.println("Erreur chargement étudiants");
        return;
    }
    
    FirebaseJson &json = fbData.jsonObject();
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;
    
    for (size_t i = 0; i < len; i++) {
        json.iteratorGet(i, type, key, value);
        
        String studentPath = "/students/" + key;
        
        // Vérifier si l'étudiant est actif
        bool isActive = false;
        if (Firebase.getBool(fbData, studentPath + "/active")) {
            isActive = fbData.boolData();
        }
        
        if (!isActive) continue;
        
        students[studentCount].id = key;
        students[studentCount].active = isActive;
        
        if (Firebase.getString(fbData, studentPath + "/name")) {
            students[studentCount].name = fbData.stringData();
        }
        
        if (Firebase.getInt(fbData, studentPath + "/fingerprint_id")) {
            students[studentCount].fingerprintId = fbData.intData();
        }
        
        if (Firebase.getString(fbData, studentPath + "/group")) {
            students[studentCount].group = fbData.stringData();
        }
        
        Serial.print("Étudiant ");
        Serial.print(studentCount);
        Serial.print(": ");
        Serial.print(students[studentCount].name);
        Serial.print(" | ID: ");
        Serial.print(students[studentCount].id);
        Serial.print(" | Empreinte: ");
        Serial.print(students[studentCount].fingerprintId);
        Serial.print(" | Groupe: ");
        Serial.println(students[studentCount].group);
        
        studentCount++;
        
        if (studentCount >= 50) break;
    }
    
    json.iteratorEnd();
    
    Serial.print("Total étudiants chargés: ");
    Serial.println(studentCount);
    showLCD("Etudiants:", String(studentCount), 1500);
}

// ---------- CHARGER LES ÉTUDIANTS DU GROUPE ACTUEL ----------
void loadGroupStudents() {
    if (currentGroup == "") return;
    
    Serial.print("\n=== CHARGEMENT ÉTUDIANTS DU GROUPE ");
    Serial.print(currentGroup);
    Serial.println(" ===");
    
    // Cette fonction peut être utilisée pour optimiser la vérification
    // Pour l'instant, nous utilisons la liste complète des étudiants
}

// ---------- TROUVER ÉTUDIANT PAR EMPREINTE ----------
Student* findStudentByFingerprint(int fingerprintId) {
    for (int i = 0; i < studentCount; i++) {
        if (students[i].fingerprintId == fingerprintId && students[i].active) {
            return &students[i];
        }
    }
    return nullptr;
}

// ---------- VÉRIFIER SI ÉTUDIANT EST DANS LE GROUPE ----------
bool isStudentInGroup(String studentId, String group) {
    // Cette fonction vérifie si l'étudiant appartient au groupe
    // Dans votre structure, le groupe est stocké dans l'étudiant
    for (int i = 0; i < studentCount; i++) {
        if (students[i].id == studentId && students[i].group == group) {
            return true;
        }
    }
    return false;
}

// ---------- ENREGISTRER PRÉSENCE ----------
void recordAttendance(Student* student) {
    if (!sessionActive || currentSessionPath == "" || currentGroup == "") {
        Serial.println("Aucune session active");
        showLCD("Erreur:", "Pas de session", 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }
    
    // Vérifier si l'étudiant est dans le bon groupe
    if (student->group != currentGroup) {
        Serial.println("Étudiant pas dans ce groupe!");
        showLCD("Erreur:", "Mauvais groupe", 2000);
        beep(100);
        delay(100);
        beep(100);
        delay(100);
        beep(100);
        return;
    }
    
    String today = getCurrentDate();
    String currentTime = getCurrentTime();
    
    // 1. Vérifier si déjà présent dans la session (nouvelle structure)
    String sessionAttendancePath = "/sessions/" + currentSessionPath + "/attendance/" + student->id;
    if (Firebase.getString(fbData, sessionAttendancePath + "/status")) {
        String status = fbData.stringData();
        if (status == "PRESENT") {
            Serial.println("Déjà présent dans cette session!");
            showLCD("Deja present!", student->name, 2000);
            beep(100);
            delay(100);
            beep(100);
            return;
        }
    }
    
    // 2. Vérifier si déjà présent dans l'ancienne structure
    String oldAttendancePath = "/attendance/" + currentGroup + "/" + today + "/present/" + student->id;
    if (Firebase.getString(fbData, oldAttendancePath + "/time")) {
        Serial.println("Déjà présent (ancienne structure)!");
        // On continue quand même pour mettre à jour la nouvelle structure
    }
    
    // 3. Enregistrer dans la NOUVELLE structure (sessions)
    FirebaseJson sessionJson;
    sessionJson.set("status", "PRESENT");
    sessionJson.set("time", currentTime);
    sessionJson.set("name", student->name);
    sessionJson.set("student_id", student->id);
    sessionJson.set("fingerprint_id", student->fingerprintId);
    
    if (Firebase.setJSON(fbData, sessionAttendancePath, sessionJson)) {
        Serial.println("Présence enregistrée dans la session!");
    } else {
        Serial.println("Erreur enregistrement dans session");
        showLCD("Erreur Firebase", "", 2000);
        return;
    }
    
    // 4. Enregistrer dans l'ANCIENNE structure pour compatibilité
    FirebaseJson oldJson;
    oldJson.set("name", student->name);
    oldJson.set("time", currentTime);
    
    if (Firebase.setJSON(fbData, oldAttendancePath, oldJson)) {
        Serial.println("Présence enregistrée dans l'ancienne structure!");
    } else {
        Serial.println("Erreur enregistrement ancienne structure");
    }
    
    // 5. Mettre à jour les statistiques de la session
    updateSessionStats();
    
    beep(300);
    showLCD("Presence OK", student->name, 2000);
}

// ---------- METTRE À JOUR STATISTIQUES DE SESSION ----------
void updateSessionStats() {
    String sessionPath = "/sessions/" + currentSessionPath;
    
    // Compter les présents dans la session
    String attendancePath = sessionPath + "/attendance";
    int presentCount = 0;
    
    if (Firebase.getJSON(fbData, attendancePath)) {
        FirebaseJson &json = fbData.jsonObject();
        size_t len = json.iteratorBegin();
        presentCount = len;
        json.iteratorEnd();
    }
    
    // Récupérer le nombre total d'étudiants dans le groupe
    int totalStudents = 0;
    
    // Compter les étudiants actifs dans ce groupe
    for (int i = 0; i < studentCount; i++) {
        if (students[i].group == currentGroup && students[i].active) {
            totalStudents++;
        }
    }
    
    // Mettre à jour les statistiques
    FirebaseJson stats;
    stats.set("total", totalStudents);
    stats.set("present", presentCount);
    stats.set("absent", totalStudents - presentCount);
    stats.set("last_update", getCurrentTime());
    
    if (Firebase.setJSON(fbData, sessionPath + "/stats", stats)) {
        Serial.print("Stats mises à jour: ");
        Serial.print(presentCount);
        Serial.print("/");
        Serial.println(totalStudents);
    } else {
        Serial.println("Erreur mise à jour stats");
    }
}

// ---------- SETUP ----------
void setup() {
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
    
    if (!finger.verifyPassword()) {
        showLCD("ERREUR", "Capteur AS608", 0);
        while (1) {
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
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        Serial.print(".");
        delay(500);
        attempts++;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nErreur WiFi!");
        showLCD("Erreur WiFi", "Verifiez config", 0);
        while (1) {
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
    
    if (!Firebase.ready()) {
        Serial.println("Erreur Firebase!");
        showLCD("Erreur Firebase", "", 0);
        while (1) {
            beep(100);
            delay(1000);
        }
    }
    
    Serial.println("Firebase connecté!");
    showLCD("Firebase OK", "", 1500);
    beep(200);
    
    // Détection de la salle
    if (!detectRoom()) {
        Serial.println("Redémarrage dans 10s...");
        delay(10000);
        ESP.restart();
    }
    
    // Charger les étudiants
    loadStudents();
    
    // Vérifier la session active
    checkActiveSession();
    
    showLCD("Pret a scanner", "Posez le doigt", 0);
    beep(200);
}

// ---------- LOOP ----------
void loop() {
    // Vérifier la session périodiquement
    if (millis() - lastSessionCheck > SESSION_CHECK_INTERVAL) {
        checkActiveSession();
        lastSessionCheck = millis();
    }
    
    // Si pas de session active, attendre
    if (!sessionActive) {
        delay(1000);
        return;
    }
    
    // Vérifier si un doigt est présent
    int result = finger.getImage();
    
    if (result == FINGERPRINT_OK) {
        result = finger.image2Tz();
        if (result != FINGERPRINT_OK) {
            Serial.println("Erreur conversion image");
            return;
        }
        
        result = finger.fingerFastSearch();
        
        if (result == FINGERPRINT_OK) {
            int foundId = finger.fingerID;
            int confidence = finger.confidence;
            
            Serial.print("\n=== EMPREINTE RECONNUE ===");
            Serial.print("\nID Empreinte: ");
            Serial.print(foundId);
            Serial.print("\nConfiance: ");
            Serial.println(confidence);
            
            // Trouver l'étudiant
            Student* student = findStudentByFingerprint(foundId);
            
            if (student != nullptr) {
                Serial.print("Étudiant: ");
                Serial.print(student->name);
                Serial.print(" (ID: ");
                Serial.print(student->id);
                Serial.print(" | Groupe: ");
                Serial.print(student->group);
                Serial.println(")");
                
                showLCD("Bonjour", student->name, 1500);
                
                // Enregistrer la présence
                recordAttendance(student);
                
            } else {
                Serial.println("Étudiant non trouvé");
                showLCD("Empreinte", "non assignee", 2000);
                beep(100);
                delay(100);
                beep(100);
            }
            
            delay(1000);
            showLCD("Pret a scanner", "Posez le doigt", 0);
        }
        else if (result == FINGERPRINT_NOTFOUND) {
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