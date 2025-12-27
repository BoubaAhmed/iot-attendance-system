#include <LiquidCrystal.h>
#include <Adafruit_Fingerprint.h>
#include <HardwareSerial.h>
#include <WiFi.h>
#include <FirebaseESP32.h>

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
#define FIREBASE_AUTH "Ton api key ici" // Clé API Firebase

FirebaseData fbData;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

// ---------- VARIABLES ----------
String studentNames[50];
String studentIds[50];
int fingerprintIds[50];
int studentCount = 0;
int currentStudent = 0;
bool enrolling = true;
int nextFingerprintId = 0; // Start from 0 for AS608

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

// ---------- ENREGISTRER EMPREINTE ----------
bool enrollFingerprint(int id) {
  int p = -1;
  
  // Étape 1: Première empreinte
  showLCD("Posez le doigt", "1ere fois", 0);
  
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    delay(50);
  }
  
  if (finger.image2Tz(1) != FINGERPRINT_OK) {
    Serial.println("Erreur image2Tz(1)");
    return false;
  }
  
  // Retirer le doigt
  showLCD("Retirez le doigt", "", 1500);
  
  int attempts = 0;
  while (finger.getImage() != FINGERPRINT_NOFINGER && attempts < 50) {
    delay(100);
    attempts++;
  }
  
  // Étape 2: Deuxième empreinte
  showLCD("Posez le meme", "doigt a nouveau", 0);
  
  p = -1;
  attempts = 0;
  while (p != FINGERPRINT_OK && attempts < 100) {
    p = finger.getImage();
    delay(50);
    attempts++;
  }
  
  if (p != FINGERPRINT_OK) {
    Serial.println("Timeout 2e empreinte");
    return false;
  }
  
  if (finger.image2Tz(2) != FINGERPRINT_OK) {
    Serial.println("Erreur image2Tz(2)");
    return false;
  }
  
  if (finger.createModel() != FINGERPRINT_OK) {
    Serial.println("Erreur createModel");
    return false;
  }
  
  if (finger.storeModel(id) != FINGERPRINT_OK) {
    Serial.println("Erreur storeModel");
    return false;
  }
  
  return true;
}

// ---------- RÉCUPÉRER LES ÉTUDIANTS ----------
void fetchStudents() {
  if (!Firebase.ready()) {
    Serial.println("Firebase non prêt");
    return;
  }
  
  showLCD("Chargement", "etudiants...", 0);
  Serial.println("\n=== CHARGEMENT DES ÉTUDIANTS ===");
  
  // Méthode: Récupérer chaque étudiant par ID (0-49)
  studentCount = 0;
  nextFingerprintId = 0; // On commence à 0
  
  for (int i = 0; i < 50; i++) {
    String studentPath = "/students/" + String(i);
    String namePath = studentPath + "/name";
    
    if (Firebase.getString(fbData, namePath)) {
      String name = fbData.stringData();
      
      if (name.length() > 0 && name != "null") {
        studentIds[studentCount] = String(i);
        studentNames[studentCount] = name;
        
        // Récupérer fingerprint_id
        String fingerPath = studentPath + "/fingerprint_id";
        if (Firebase.getInt(fbData, fingerPath)) {
          int fingerprintId = fbData.intData();
          fingerprintIds[studentCount] = fingerprintId;
          
          // Si fingerprint_id > 0, garder une trace du plus grand ID
          if (fingerprintId > nextFingerprintId) {
            nextFingerprintId = fingerprintId;
          }
          
          Serial.print("Étudiant ");
          Serial.print(studentCount + 1);
          Serial.print(": ID=");
          Serial.print(studentIds[studentCount]);
          Serial.print(", Nom=");
          Serial.print(studentNames[studentCount]);
          Serial.print(", Fingerprint ID=");
          Serial.println(fingerprintIds[studentCount]);
        } else {
          // Si pas de fingerprint_id, mettre 0 (pas encore enregistré)
          fingerprintIds[studentCount] = 0;
          Serial.print("Étudiant ");
          Serial.print(studentCount + 1);
          Serial.print(": ID=");
          Serial.print(studentIds[studentCount]);
          Serial.print(", Nom=");
          Serial.print(studentNames[studentCount]);
          Serial.println(", Fingerprint ID=0 (pas encore)");
        }
        
        studentCount++;
      }
    }
    
    // Si nous avons attendu trop longtemps sans trouver d'étudiants, arrêter
    if (i >= 10 && studentCount == 0) {
      Serial.println("Aucun étudiant trouvé dans les 10 premiers indices");
      break;
    }
  }
  
  // Maintenant, nextFingerprintId contient le plus grand ID utilisé
  // On l'incrémente pour avoir le prochain ID disponible
  nextFingerprintId++;
  
  Serial.print("\nTotal étudiants trouvés: ");
  Serial.println(studentCount);
  Serial.print("Prochain ID empreinte disponible: ");
  Serial.println(nextFingerprintId);
  
  if (studentCount > 0) {
    showLCD("Etudiants:", String(studentCount), 2000);
    beep(200);
  } else {
    showLCD("Aucun etudiant", "trouvé", 2000);
    beep(100); beep(100);
  }
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(BUZZER_PIN, OUTPUT);
  
  // LCD
  lcd.begin(16, 2);
  showLCD("Systeme", "empreintes", 2000);
  
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
  
  // VIDER LA BASE DES EMPREINTES
  showLCD("Suppression", "empreintes...", 1000);
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    Serial.println("Base d'empreintes vidée");
    showLCD("Base videe", "", 1500);
    beep(300);
  } else {
    Serial.println("Erreur vidage base");
    showLCD("Erreur vidage", "", 1500);
  }
  
  // Connexion WiFi
  showLCD("Connexion WiFi", "", 0);
  Serial.print("Connexion WiFi ");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    Serial.print(".");
    lcd.setCursor(0, 1);
    lcd.print("Tentative ");
    lcd.print(attempts + 1);
    delay(500);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connecté!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    showLCD("WiFi OK", WiFi.localIP().toString(), 2000);
  } else {
    Serial.println("\nErreur WiFi");
    showLCD("Erreur WiFi", "Mode local", 2000);
    showLCD("Redémarrez", "avec WiFi", 0);
    while(1) {
      beep(100);
      delay(2000);
    }
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
  
  if (!Firebase.ready()) {
    Serial.println("Erreur connexion Firebase");
    showLCD("Erreur Firebase", "Mode local", 2000);
    showLCD("Redémarrez", "pour Firebase", 0);
    while(1) {
      beep(100);
      delay(2000);
    }
  }
  
  Serial.println("Firebase connecté!");
  showLCD("Firebase OK", "", 1500);
  beep(200);
  
  // Récupérer les étudiants
  fetchStudents();
  
  if (studentCount == 0) {
    showLCD("Aucun etudiant", "Redémarrez", 2000);
    while(1) {
      beep(100);
      delay(2000);
    }
  }
  
  delay(2000);
  
  // Commencer l'enregistrement
  showLCD("Pret pour", "enregistrement", 2000);
  currentStudent = 0;
  showNextStudent();
}

// ---------- AFFICHER ÉTUDIANT SUIVANT ----------
void showNextStudent() {
  if (currentStudent >= studentCount) {
    enrolling = false;
    showLCD("Termine!", "Tous enregistres", 3000);
    showLCD("Redémarrez", "pour recommencer", 0);
    Serial.println("\n=== ENREGISTREMENT TERMINÉ ===");
    while(1) {
      beep(200);
      delay(3000);
    }
  }
  
  Serial.print("\n=== ENREGISTREMENT ÉTUDIANT ");
  Serial.print(currentStudent + 1);
  Serial.print("/");
  Serial.print(studentCount);
  Serial.println(" ===");
  Serial.print("Nom: ");
  Serial.println(studentNames[currentStudent]);
  Serial.print("Firebase ID: ");
  Serial.println(studentIds[currentStudent]);
  Serial.print("ID Empreinte actuel: ");
  Serial.println(fingerprintIds[currentStudent]);
  
  // Si fingerprint_id == 0, c'est qu'il n'a pas encore d'empreinte
  // Si fingerprint_id > 0, c'est qu'il a déjà une empreinte
  if (fingerprintIds[currentStudent] > 0) {
    Serial.println("Cet étudiant a déjà une empreinte, passage au suivant...");
    currentStudent++;
    showNextStudent();
    return;
  }
  
  // Si fingerprint_id == 0, on peut enregistrer
  showLCD("Etudiant:", studentNames[currentStudent], 2000);
  showLCD("Posez le doigt", "sur capteur", 2000);
  Serial.println("En attente de l'empreinte digitale...");
}

// ---------- METTRE À JOUR FIREBASE ----------
void updateFirebaseFingerprint(String studentId, int fingerprintId) {
  String path = "/students/" + studentId + "/fingerprint_id";
  
  Serial.print("Mise à jour Firebase... ");
  Serial.print(studentId);
  Serial.print(" -> ");
  Serial.println(fingerprintId);
  
  if (Firebase.setInt(fbData, path, fingerprintId)) {
    Serial.println("Firebase mis à jour avec succès!");
    // Mettre à jour localement aussi
    for (int i = 0; i < studentCount; i++) {
      if (studentIds[i] == studentId) {
        fingerprintIds[i] = fingerprintId;
        break;
      }
    }
  } else {
    Serial.print("Erreur Firebase: ");
    Serial.println(fbData.errorReason());
    
    // Réessayer une fois
    delay(1000);
    if (Firebase.setInt(fbData, path, fingerprintId)) {
      Serial.println("Réussite au 2e essai!");
    } else {
      Serial.println("Échec après 2 essais");
    }
  }
}

// ---------- TROUVER ID DISPONIBLE ----------
int findAvailableId() {
  // Retourner le prochain ID disponible
  int id = nextFingerprintId;
  nextFingerprintId++;
  
  // Vérifier que l'ID est dans la plage valide (0-127 pour AS608)
  if (nextFingerprintId > 127) {
    Serial.println("ATTENTION: Plage d'IDs empreintes dépassée!");
    showLCD("ERREUR", "IDs > 127", 2000);
  }
  
  Serial.print("Nouvel ID empreinte: ");
  Serial.println(id);
  return id;
}

// ---------- LOOP ----------
void loop() {
  if (!enrolling) return;
  
  // Vérifier si un doigt est présent
  int result = finger.getImage();
  
  if (result == FINGERPRINT_OK) {
    // Générer un ID pour l'empreinte (commence à 0)
    int newFingerprintId = findAvailableId();
    
    showLCD("Enregistrement", "en cours...", 0);
    Serial.print("Enregistrement empreinte ID ");
    Serial.println(newFingerprintId);
    
    // Enregistrer l'empreinte
    if (enrollFingerprint(newFingerprintId)) {
      // Succès
      Serial.println("Empreinte enregistrée avec succès!");
      showLCD("Succes!", "ID: " + String(newFingerprintId), 2000);
      beep(500);
      
      // Mettre à jour Firebase
      updateFirebaseFingerprint(studentIds[currentStudent], newFingerprintId);
      
      // Passer au suivant
      currentStudent++;
      delay(2000);
      showNextStudent();
      
    } else {
      // Échec
      Serial.println("Échec enregistrement");
      showLCD("Echec!", "Reessayez", 2000);
      beep(100); delay(100); beep(100); delay(100); beep(100);
      delay(2000);
      showNextStudent();
    }
  } else if (result == FINGERPRINT_NOFINGER) {
    // Pas de doigt, continuer à attendre
    static unsigned long lastDisplay = 0;
    if (millis() - lastDisplay > 3000) {
      // Afficher un message d'attente toutes les 3 secondes
      showLCD("En attente...", studentNames[currentStudent], 0);
      lastDisplay = millis();
    }
  } else {
    // Erreur de capteur
    Serial.print("Erreur capteur: ");
    Serial.println(result);
  }
  
  delay(100);
}