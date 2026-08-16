const { GoogleAuth } = require("google-auth-library");
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

const auth = new GoogleAuth({
  credentials: { client_email: clientEmail, private_key: privateKey },
  scopes: ["https://www.googleapis.com/auth/datastore"],
});

async function main() {
  const token = await auth.getAccessToken();
  console.log("GOT TOKEN len", token ? token.length : 0);
  const url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/users?pageSize=1";
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  const text = await res.text();
  console.log("STATUS", res.status);
  console.log("BODY", text.slice(0, 1500));
}

main().catch((e) => console.error("ERROR", e.message));
