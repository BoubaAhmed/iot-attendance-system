#include <WiFi.h>
#include <Firebase_Client.h>

// WiFi (Wokwi)
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASSWORD ""

// Firebase (à partir de TA config)
#define API_KEY "AIzaSyCiQkuIHnCFbAxfhxMpdVfk0PymoYkY66g"
#define DATABASE_URL "https://iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app"

// Auth Firebase (email/password)
#define USER_EMAIL "ahmedbouba@gmail.com"
#define USER_PASSWORD "adminadmin"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);

  // Connexion WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connexion WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi connecté");

  // Config Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase connecté");
}

void loop() {

  if (Firebase.RTDB.getString(&fbdo, "/attendance/room1/status")) {
    Serial.print("Status salle: ");
    Serial.println(fbdo.stringData());
  } else {
    Serial.println("Erreur status: " + fbdo.errorReason());
  }

  if (Firebase.RTDB.getInt(&fbdo, "/attendance/room1/students")) {
    Serial.print("Nombre étudiants: ");
    Serial.println(fbdo.intData());
  } else {
    Serial.println("Erreur students: " + fbdo.errorReason());
  }

  Serial.println("---------------------");
  delay(3000);
}
