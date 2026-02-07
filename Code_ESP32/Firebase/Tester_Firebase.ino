#include <WiFi.h>
#include <FirebaseESP32.h>

// Configuration WiFi
#define WIFI_SSID "inwi Home 4G9399CB"
#define WIFI_PASSWORD "38879322"

// Configuration Firebase
#define FIREBASE_HOST "iot-attendance-systeme-default-rtdb.europe-west1.firebasedatabase.app" // Sans https:// et sans /
#define FIREBASE_AUTH "Ton api key ici" // Clé API Firebase

// Objets Firebase
FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

void setup()
{
    Serial.begin(115200);

    // Connexion WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connexion au WiFi");

    while (WiFi.status() != WL_CONNECTED)
    {
        Serial.print(".");
        delay(300);
    }

    Serial.println();
    Serial.print("Connecté avec l'IP: ");
    Serial.println(WiFi.localIP());

    // Configuration Firebase
    config.host = FIREBASE_HOST;
    config.signer.tokens.legacy_token = FIREBASE_AUTH;

    // Initialisation Firebase
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // Définir la taille du buffer (optionnel)
    firebaseData.setBSSLBufferSize(1024, 1024);

    Serial.println("Firebase connecté!");
}

void loop()
{
    // Exemple 1: Écrire une valeur entière
    if (Firebase.setInt(firebaseData, "/test/valeur", 42))
    {
        Serial.println("Écriture réussie: /test/valeur = 42");
    }
    else
    {
        Serial.println("Erreur d'écriture: " + firebaseData.errorReason());
    }

    delay(2000);

    // Exemple 2: Écrire une chaîne de caractères
    if (Firebase.setString(firebaseData, "/test/message", "Hello Firebase!"))
    {
        Serial.println("Message envoyé avec succès");
    }
    else
    {
        Serial.println("Erreur: " + firebaseData.errorReason());
    }

    delay(2000);

    // Exemple 3: Lire une valeur
    if (Firebase.getInt(firebaseData, "/test/valeur"))
    {
        if (firebaseData.dataType() == "int")
        {
            int valeur = firebaseData.intData();
            Serial.print("Valeur lue: ");
            Serial.println(valeur);
        }
    }
    else
    {
        Serial.println("Erreur de lecture: " + firebaseData.errorReason());
    }

    delay(2000);

    // Exemple 4: Envoyer plusieurs données (JSON)
    FirebaseJson json;
    json.set("temperature", 25.5);
    json.set("humidite", 60);
    json.set("timestamp", millis());

    if (Firebase.setJSON(firebaseData, "/capteurs/data", json))
    {
        Serial.println("Données JSON envoyées");
    }
    else
    {
        Serial.println("Erreur JSON: " + firebaseData.errorReason());
    }

    delay(5000);

    // Exemple 5: Push (ajouter avec ID auto)
    if (Firebase.pushInt(firebaseData, "/historique", random(0, 100)))
    {
        Serial.println("Données ajoutées à l'historique");
        Serial.print("Chemin créé: ");
        Serial.println(firebaseData.dataPath());
    }

    delay(5000);
}
