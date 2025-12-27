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

// ---------- FIREBASE ----------
#define WIFI_SSID "inwi Home 4G9399CB"
#define WIFI_PASSWORD "38879322"

#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyCiQkuIHnCFbAxfhxMpdVfk0PymoYkY66g"

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- NTP ----------
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;  // GMT+0
const int daylightOffset_sec = 3600;  // 1 hour for daylight saving

// ---------- VARIABLES ----------
String studentNames[50];
int fingerprintIds[50];
String studentIds[50];
String studentGroups[50];
int studentCount = 0;
bool wifiConnected = false;
bool timeConfigured = false;
String lastScannedStudentId = ""; // Track last scanned student
unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 5000; // 5 seconds cooldown between scans

// ---------- BEEP ----------
void beep(int t) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(t);
  digitalWrite(BUZZER_PIN, LOW);
}

// ---------- AFFICHER LCD ----------
void showLCD(String line1, String line2 = "", int delayMs = 0) {
  lcd.clear();
  lcd.print(line1);
  if (line2.length() > 0) {
    lcd.setCursor(0, 1);
    lcd.print(line2);
  }
  if (delayMs > 0) delay(delayMs);
}

// ---------- GET CURRENT DATE AND TIME ----------
String getCurrentDate() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return "1970-01-01";
  }
  
  char dateBuffer[11];
  strftime(dateBuffer, sizeof(dateBuffer), "%Y-%m-%d", &timeinfo);
  return String(dateBuffer);
}

String getCurrentDateTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return "1970-01-01T00:00:00.000Z";
  }
  
  char timeBuffer[30];
  strftime(timeBuffer, sizeof(timeBuffer), "%Y-%m-%dT%H:%M:%S.000Z", &timeinfo);
  return String(timeBuffer);
}

// ---------- CONFIGURE TIME ----------
void configureTime() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  struct tm timeinfo;
  int attempts = 0;
  while (!getLocalTime(&timeinfo) && attempts < 10) {
    Serial.print(".");
    delay(500);
    attempts++;
  }
  
  if (getLocalTime(&timeinfo)) {
    timeConfigured = true;
    Serial.println("\nTime configured successfully");
    
    char timeBuffer[30];
    strftime(timeBuffer, sizeof(timeBuffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.print("Current time: ");
    Serial.println(timeBuffer);
  } else {
    Serial.println("\nFailed to configure time");
  }
}

// ---------- RÉCUPÉRER LES ÉTUDIANTS ----------
void fetchStudents() {
  if (!Firebase.ready()) {
    Serial.println("Firebase non prêt");
    return;
  }
  
  showLCD("Chargement", "etudiants...", 0);
  Serial.println("\n=== CHARGEMENT DES ÉTUDIANTS ===");
  
  studentCount = 0;
  
  for (int i = 0; i < 50; i++) {
    String studentPath = "/students/" + String(i);
    String namePath = studentPath + "/name";
    
    if (Firebase.getString(fbData, namePath)) {
      String name = fbData.stringData();
      
      if (name.length() > 0 && name != "null") {
        studentIds[studentCount] = String(i);
        studentNames[studentCount] = name;
        
        String fingerPath = studentPath + "/fingerprint_id";
        if (Firebase.getInt(fbData, fingerPath)) {
          fingerprintIds[studentCount] = fbData.intData();
        } else {
          fingerprintIds[studentCount] = 0;
        }
        
        String groupPath = studentPath + "/group";
        if (Firebase.getString(fbData, groupPath)) {
          studentGroups[studentCount] = fbData.stringData();
        } else {
          studentGroups[studentCount] = "G1";
        }
        
        Serial.print("Étudiant ");
        Serial.print(studentCount + 1);
        Serial.print(": ID=");
        Serial.print(studentIds[studentCount]);
        Serial.print(", Nom=");
        Serial.print(studentNames[studentCount]);
        Serial.print(", Groupe=");
        Serial.print(studentGroups[studentCount]);
        Serial.print(", Fingerprint ID=");
        Serial.println(fingerprintIds[studentCount]);
        
        studentCount++;
      }
    }
    
    if (i >= 10 && studentCount == 0) break;
  }
  
  Serial.print("\nTotal étudiants trouvés: ");
  Serial.println(studentCount);
  
  if (studentCount > 0) {
    showLCD("Etudiants:", String(studentCount), 2000);
    beep(200);
  } else {
    showLCD("Aucun etudiant", "trouvé", 2000);
    beep(100); beep(100);
  }
}

// ---------- TROUVER ÉTUDIANT PAR ID EMPREINTE ----------
int findStudentByFingerprintId(int fingerprintId) {
  for (int i = 0; i < studentCount; i++) {
    if (fingerprintIds[i] == fingerprintId) {
      return i;
    }
  }
  return -1;
}

// ---------- CHECK ATTENDANCE BY QUERYING ----------
bool checkAttendanceExists(String date, String group, String studentId) {
  // Query attendance for today's date and group
  String path = "/attendance/" + date + "/" + group;
  
  // First check if there's any data for this date/group
  if (Firebase.get(fbData, path)) {
    FirebaseJson *json = fbData.jsonObjectPtr();
    
    if (json) {
      size_t count = json->iteratorBegin();
      String key, value = "";
      int type = 0;
      
      for (size_t i = 0; i < count; i++) {
        json->iteratorGet(i, type, key, value);
        
        // Check if this key contains the student's attendance
        String recordPath = path + "/" + key;
        
        if (Firebase.get(fbData, recordPath + "/student_id")) {
          String existingStudentId = fbData.stringData();
          
          if (existingStudentId == studentId) {
            // Student already has attendance for today
            return true;
          }
        }
      }
      json->iteratorEnd();
    }
  }
  
  return false;
}

// ---------- ALTERNATIVE SIMPLE CHECK ----------
bool simpleAttendanceCheck(String date, String group, String studentId) {
  // Try a simpler approach - directly check if path exists
  String path = "/attendance/" + date + "/" + group;
  
  // Get all records for today's group
  if (Firebase.get(fbData, path)) {
    String jsonString = fbData.jsonString();
    
    // Search for student ID in the JSON string
    // This is a simple but effective check
    String searchPattern = "\"student_id\":\"" + studentId + "\"";
    if (jsonString.indexOf(searchPattern) != -1) {
      return true;
    }
  }
  
  return false;
}

// ---------- UPDATE ATTENDANCE ----------
void updateAttendance(String studentId, String studentName, String group) {
  if (!wifiConnected || !Firebase.ready()) {
    Serial.println("Impossible de mettre à jour la présence (pas de connexion)");
    return;
  }
  
  // Get current date
  String currentDate = getCurrentDate();
  if (currentDate == "1970-01-01") {
    Serial.println("Erreur: Impossible d'obtenir la date actuelle");
    showLCD("Erreur date", "Reessayez", 2000);
    return;
  }
  
  // Check if student already marked today (using simple check)
  if (simpleAttendanceCheck(currentDate, group, studentId)) {
    Serial.println("Présence déjà enregistrée pour aujourd'hui!");
    showLCD("Deja present", "Aujourd'hui", 2000);
    
    // Show already marked message
    showLCD(studentName, "Deja marque", 2000);
    beep(100); beep(100); // Different beep pattern for duplicate
    return;
  }
  
  // Get current timestamp
  String currentDateTime = getCurrentDateTime();
  
  // Create attendance record with timestamp as key
  String timestamp = String(millis());
  String path = "/attendance/" + currentDate + "/" + group + "/" + timestamp;
  
  // Create JSON record
  FirebaseJson record;
  record.set("student_id", studentId);
  record.set("student_name", studentName);
  record.set("status", "PRESENT");
  record.set("created_at", currentDateTime);
  record.set("timestamp", timestamp);
  
  // Store in Firebase
  if (Firebase.setJSON(fbData, path.c_str(), record)) {
    Serial.println("=== PRÉSENCE ENREGISTRÉE ===");
    Serial.print("Date: ");
    Serial.println(currentDate);
    Serial.print("Groupe: ");
    Serial.println(group);
    Serial.print("Étudiant: ");
    Serial.println(studentName);
    Serial.print("ID: ");
    Serial.println(studentId);
    Serial.print("Heure: ");
    Serial.println(currentDateTime);
    
    showLCD("Present!", studentName, 2000);
    beep(500); // Success beep
  } else {
    Serial.print("Erreur enregistrement: ");
    Serial.println(fbData.errorReason());
    
    showLCD("Erreur", "Reessayez", 2000);
    beep(100); beep(100); beep(100); // Error beep pattern
  }
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(BUZZER_PIN, OUTPUT);
  
  // LCD
  lcd.begin(16, 2);
  showLCD("Systeme", "de presence", 2000);
  
  // Capteur empreinte
  mySerial.begin(57600, SERIAL_8N1, 16, 17);
  finger.begin(57600);
  delay(1000);
  
  if (!finger.verifyPassword()) {
    showLCD("ERREUR", "Capteur AS608", 0);
    Serial.println("Capteur AS608 non détecté!");
    while(1) {
      beep(100);
      delay(1000);
    }
  }
  
  Serial.println("AS608 détecté");
  showLCD("AS608 OK", "", 1500);
  beep(200);
  
  // Vérifier empreintes
  showLCD("Verification", "empreintes...", 1000);
  
  if (finger.getTemplateCount() == FINGERPRINT_OK) {
    Serial.print("Empreintes dans capteur: ");
    Serial.println(finger.templateCount);
    showLCD("Empreintes:", String(finger.templateCount), 2000);
  } else {
    Serial.println("Erreur lecture templates");
    showLCD("Erreur lecture", "empreintes", 2000);
  }
  
  // Connexion WiFi
  showLCD("Connexion WiFi", "", 0);
  Serial.print("Connexion WiFi ");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    lcd.setCursor(0, 1);
    lcd.print("Tentative ");
    lcd.print(attempts + 1);
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi connecté!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    showLCD("WiFi OK", WiFi.localIP().toString(), 2000);
    beep(200);
    
    // Configuration heure
    showLCD("Configuration", "heure...", 0);
    configureTime();
    
    if (timeConfigured) {
      showLCD("Heure OK", "", 1500);
    } else {
      showLCD("Erreur heure", "", 1500);
    }
    
    // Connexion Firebase
    fbConfig.host = FIREBASE_HOST;
    fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
    
    showLCD("Connexion", "Firebase...", 0);
    Firebase.begin(&fbConfig, &fbAuth);
    Firebase.reconnectWiFi(true);
    delay(2000);
    
    int firebaseAttempts = 0;
    while (!Firebase.ready() && firebaseAttempts < 10) {
      Serial.print(".");
      delay(500);
      firebaseAttempts++;
    }
    
    if (Firebase.ready()) {
      Serial.println("Firebase connecté!");
      showLCD("Firebase OK", "", 1500);
      beep(200);
      
      // Récupérer étudiants
      fetchStudents();
    } else {
      Serial.println("Erreur connexion Firebase");
      showLCD("Erreur Firebase", "Mode local", 2000);
    }
  } else {
    Serial.println("\nMode local (sans WiFi)");
    showLCD("Mode local", "", 2000);
    beep(100); beep(100);
  }
  
  delay(2000);
  showLCD("Pret a scanner", "Posez le doigt", 2000);
  Serial.println("\n=== PRET POUR RECONNAISSANCE ===");
}

// ---------- LOOP ----------
void loop() {
  // Vérifier cooldown pour éviter scans multiples rapides
  if (millis() - lastScanTime < SCAN_COOLDOWN) {
    return;
  }
  
  int result = finger.getImage();
  
  if (result == FINGERPRINT_OK) {
    lastScanTime = millis(); // Start cooldown
    
    // Convertir image
    result = finger.image2Tz();
    if (result != FINGERPRINT_OK) {
      Serial.println("Erreur conversion image");
      showLCD("Erreur", "Reessayez", 1000);
      showLCD("Pret a scanner", "Posez le doigt", 0);
      return;
    }
    
    // Rechercher empreinte
    result = finger.fingerFastSearch();
    
    if (result == FINGERPRINT_OK) {
      int foundId = finger.fingerID;
      int confidence = finger.confidence;
      
      Serial.print("\n=== EMPREINTE RECONNUE ===");
      Serial.print("\nID Empreinte: ");
      Serial.print(foundId);
      Serial.print("\nConfiance: ");
      Serial.println(confidence);
      
      // Trouver étudiant
      int studentIndex = findStudentByFingerprintId(foundId);
      
      if (studentIndex >= 0) {
        String studentName = studentNames[studentIndex];
        String studentId = studentIds[studentIndex];
        String studentGroup = studentGroups[studentIndex];
        
        // Vérifier si c'est le même étudiant que le dernier scan
        if (studentId == lastScannedStudentId && (millis() - lastScanTime) < 10000) {
          Serial.println("Même étudiant récemment scanné");
          showLCD("Deja scanne", "recemment", 2000);
          beep(100); delay(100); beep(100);
          showLCD("Pret a scanner", "Posez le doigt", 0);
          lastScanTime = millis(); // Reset cooldown
          return;
        }
        
        lastScannedStudentId = studentId;
        
        // Afficher sur LCD
        showLCD(studentName, "", 0);
        lcd.setCursor(0, 1);
        lcd.print("G");
        lcd.print(studentGroup.substring(1));
        lcd.print(" ID:");
        lcd.print(studentId);
        
        Serial.print("Etudiant: ");
        Serial.println(studentName);
        Serial.print("ID: ");
        Serial.println(studentId);
        Serial.print("Groupe: ");
        Serial.println(studentGroup);
        
        // Mettre à jour présence
        if (wifiConnected && Firebase.ready()) {
          updateAttendance(studentId, studentName, studentGroup);
        } else {
          showLCD("Mode local", "", 2000);
        }
        
        delay(2000);
        showLCD("Pret a scanner", "Posez le doigt", 0);
        
      } else {
        // Empreinte non assignée
        showLCD("Non assigne", "ID:" + String(foundId), 2000);
        Serial.print("Empreinte ID ");
        Serial.print(foundId);
        Serial.println(" non assignee");
        
        beep(100); delay(100); beep(100);
        delay(2000);
        showLCD("Pret a scanner", "Posez le doigt", 0);
      }
      
    } else if (result == FINGERPRINT_NOTFOUND) {
      Serial.println("Empreinte non reconnue");
      showLCD("Non reconnu", "Essayez encore", 2000);
      beep(100); delay(100); beep(100);
      showLCD("Pret a scanner", "Posez le doigt", 0);
    } else {
      Serial.print("Erreur recherche: ");
      Serial.println(result);
      showLCD("Erreur recherche", "Reessayez", 2000);
      showLCD("Pret a scanner", "Posez le doigt", 0);
    }
  } else if (result == FINGERPRINT_NOFINGER) {
    // Pas de doigt
  } else {
    Serial.print("Erreur capteur: ");
    Serial.println(result);
  }
  
  delay(100);
}