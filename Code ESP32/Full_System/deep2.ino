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
#define FIREBASE_AUTH "key" // Clé API Firebase

// ---------- ESP32 ID (À MODIFIER SELON VOTRE ESP32) ----------
#define ESP32_ID "ESP32_A"  // Changez en "ESP32_B" pour l'autre salle
#define ESP32_ROOM_NAME "roomA"

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- NTP TIME SERVER ----------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 3600;

// ---------- VARIABLES GLOBALES ----------
String currentRoom = "";
String currentSessionId = ""; // Format: "20260206_roomA_0800_G1"
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
        return "2026-02-06"; // Date par défaut en cas d'erreur
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
    
    // Les sessions sont stockées dans un tableau JSON
    FirebaseJsonArray &sessionsArray = fbData.jsonArray();
    size_t arrayLen = sessionsArray.size();
    
    Serial.print("Nombre de sessions trouvées: ");
    Serial.println(arrayLen);
    
    bool foundActiveSession = false;
    
    for (size_t i = 0; i < arrayLen; i++) {
        FirebaseJsonData sessionData;
        sessionsArray.get(sessionData, i);
        
        if (sessionData.typeNum == FirebaseJson::JSON_OBJECT) {
            FirebaseJson &sessionJson = sessionData.jsonObject;
            
            String sessionId, status, startTime, endTime, group, subject;
            int startMinutes, endMinutes;
            
            // Récupérer les données de la session
            if (sessionJson.get("session_id", sessionId) &&
                sessionJson.get("status", status) &&
                sessionJson.get("start", startTime) &&
                sessionJson.get("end", endTime) &&
                sessionJson.get("group", group) &&
                sessionJson.get("subject", subject)) {
                
                startMinutes = timeToMinutes(startTime);
                endMinutes = timeToMinutes(endTime);
                
                Serial.print("Session: ");
                Serial.print(sessionId);
                Serial.print(" | Statut: ");
                Serial.print(status);
                Serial.print(" | De ");
                Serial.print(startTime);
                Serial.print(" à ");
                Serial.println(endTime);
                
                // Vérifier si la session est active (ACTIVE) ou planifiée (SCHEDULED)
                // et si l'heure actuelle est dans la plage horaire
                if ((status == "ACTIVE" || status == "SCHEDULED") &&
                    currentMinutes >= (startMinutes - 5) && // 5 minutes avant le début
                    currentMinutes <= (endMinutes + 5)) {   // 5 minutes après la fin
                    
                    // Si c'est une session planifiée et qu'on est dans les 5 minutes avant/après,
                    // on peut la marquer comme ACTIVE
                    if (status == "SCHEDULED" && currentMinutes >= startMinutes) {
                        // Mettre à jour le statut de la session
                        sessionJson.set("status", "ACTIVE");
                        sessionJson.set("started_at", getCurrentTime());
                        
                        // Enregistrer la mise à jour dans Firebase
                        String updatePath = roomSessionsPath + "/" + i;
                        Firebase.setJSON(fbData, updatePath, sessionJson);
                        Serial.println("Session marquée comme ACTIVE");
                    }
                    
                    // Si la session est CLOSED, on ne fait rien
                    if (status == "CLOSED") {
                        continue;
                    }
                    
                    // Récupérer le nom de la matière
                    String subjectName = subject;
                    if (Firebase.getString(fbData, "/subjects/" + subject + "/name")) {
                        subjectName = fbData.stringData();
                    }
                    
                    // Définir les variables globales
                    currentSessionId = sessionId;
                    currentGroup = group;
                    currentSubject = subject;
                    currentSubjectName = subjectName;
                    sessionActive = true;
                    foundActiveSession = true;
                    
                    Serial.print("Session active détectée: ");
                    Serial.println(sessionId);
                    Serial.print("Groupe: ");
                    Serial.println(currentGroup);
                    Serial.print("Matière: ");
                    Serial.println(currentSubjectName);
                    
                    // Charger les étudiants du groupe actuel
                    loadGroupStudents();
                    
                    // Afficher sur LCD
                    showLCD("Session active", currentSubjectName, 2000);
                    break;
                }
            }
        }
    }
    
    if (!foundActiveSession) {
        Serial.println("Pas de session active en ce moment");
        sessionActive = false;
        currentSessionId = "";
        currentGroup = "";
        currentSubject = "";
        currentSubjectName = "";
        showLCD("Pas de session", "active", 2000);
    }
    
    return foundActiveSession;
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
        
        // Vérifier le groupe de l'étudiant
        String studentGroup = "";
        if (Firebase.getString(fbData, studentPath + "/group")) {
            studentGroup = fbData.stringData();
        }
        
        // Ne charger que les étudiants du groupe actuel
        if (studentGroup != currentGroup) continue;
        
        students[studentCount].id = key;
        students[studentCount].active = isActive;
        
        if (Firebase.getString(fbData, studentPath + "/name")) {
            students[studentCount].name = fbData.stringData();
        }
        
        if (Firebase.getInt(fbData, studentPath + "/fingerprint_id")) {
            students[studentCount].fingerprintId = fbData.intData();
        }
        
        students[studentCount].group = studentGroup;
        
        Serial.print("Étudiant groupe ");
        Serial.print(studentCount);
        Serial.print(": ");
        Serial.print(students[studentCount].name);
        Serial.print(" | ID: ");
        Serial.print(students[studentCount].id);
        Serial.print(" | Empreinte: ");
        Serial.println(students[studentCount].fingerprintId);
        
        studentCount++;
        
        if (studentCount >= 50) break;
    }
    
    json.iteratorEnd();
    
    Serial.print("Étudiants du groupe chargés: ");
    Serial.println(studentCount);
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

// ---------- ENREGISTRER PRÉSENCE ----------
void recordAttendance(Student* student) {
    if (!sessionActive || currentSessionId == "" || currentGroup == "") {
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
    
    String currentTime = getCurrentTime();
    
    // Vérifier si l'étudiant est déjà présent
    String attendancePath = "/attendance/" + currentSessionId + "/present/" + student->id;
    
    if (Firebase.getString(fbData, attendancePath + "/time")) {
        String existingTime = fbData.stringData();
        Serial.println("Étudiant déjà présent!");
        showLCD("Deja present", student->name, 2000);
        beep(100);
        delay(100);
        beep(100);
        return;
    }
    
    // Enregistrer la présence dans le format spécifié
    FirebaseJson presentJson;
    presentJson.set("name", student->name);
    presentJson.set("time", currentTime);
    
    if (Firebase.setJSON(fbData, attendancePath, presentJson)) {
        Serial.println("Présence enregistrée!");
        
        // Mettre à jour le statut de la session si nécessaire
        updateSessionStatus();
        
        beep(300);
        showLCD("Presence OK", student->name, 2000);
    } else {
        Serial.println("Erreur enregistrement présence");
        showLCD("Erreur Firebase", "", 2000);
        beep(100);
        delay(100);
        beep(100);
        delay(100);
        beep(100);
    }
}

// ---------- METTRE À JOUR STATUT DE SESSION ----------
void updateSessionStatus() {
    if (currentSessionId == "") return;
    
    String today = getCurrentDate();
    String currentTime = getCurrentTime();
    
    // Trouver la session pour la mettre à jour
    String sessionsPath = "/sessions/" + today;
    if (!Firebase.getJSON(fbData, sessionsPath)) {
        return;
    }
    
    // Vérifier les sessions pour cette salle
    String roomSessionsPath = sessionsPath + "/" + currentRoom;
    if (!Firebase.getJSON(fbData, roomSessionsPath)) {
        return;
    }
    
    // Les sessions sont stockées dans un tableau JSON
    FirebaseJsonArray &sessionsArray = fbData.jsonArray();
    size_t arrayLen = sessionsArray.size();
    
    for (size_t i = 0; i < arrayLen; i++) {
        FirebaseJsonData sessionData;
        sessionsArray.get(sessionData, i);
        
        if (sessionData.typeNum == FirebaseJson::JSON_OBJECT) {
            FirebaseJson &sessionJson = sessionData.jsonObject;
            
            String sessionId;
            if (sessionJson.get("session_id", sessionId)) {
                if (sessionId == currentSessionId) {
                    // Mettre à jour le statut si nécessaire
                    String status;
                    if (sessionJson.get("status", status)) {
                        if (status == "SCHEDULED") {
                            sessionJson.set("status", "ACTIVE");
                            sessionJson.set("started_at", currentTime);
                            
                            // Enregistrer la mise à jour
                            String updatePath = roomSessionsPath + "/" + i;
                            Firebase.setJSON(fbData, updatePath, sessionJson);
                            Serial.println("Session mise à jour: ACTIVE");
                        }
                    }
                    break;
                }
            }
        }
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
    
    // Afficher la session active
    showLCD("Session active", currentSubjectName, 0);
    
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
        }
        else if (result == FINGERPRINT_NOTFOUND) {
            Serial.println("Empreinte non reconnue");
            showLCD("Non reconnu", "Essayez encore", 2000);
            beep(100);
            delay(100);
            beep(100);
        }
    }
    
    delay(100);
}