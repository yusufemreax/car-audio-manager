import {
  randomBytes,
  scryptSync,
} from "node:crypto";

function readHidden(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error("Bu script interaktif bir terminalde çalıştırılmalıdır.")
      );
      return;
    }

    const stdin = process.stdin;
    let value = "";

    process.stdout.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }

        value += char;
        process.stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  console.log("Car Audio Manager - Tek Kullanıcı Giriş Ayarı\n");

  const password = await readHidden("Kullanmak istediğiniz şifre: ");

  if (password.length < 10) {
    throw new Error("Şifre en az 10 karakter olmalıdır.");
  }

  const confirmation = await readHidden("Şifreyi tekrar girin: ");

  if (password !== confirmation) {
    throw new Error("Girilen şifreler aynı değil.");
  }

  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  const authSecret = randomBytes(48).toString("base64url");

  console.log("\nAşağıdaki değerleri .env.local ve Vercel Environment Variables alanına ekleyin:\n");
  console.log("APP_LOGIN_USER=admin");
  console.log(
    `APP_LOGIN_PASSWORD_HASH=scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
  );
  console.log(`APP_AUTH_SECRET=${authSecret}`);
  console.log("\nŞifrenin kendisi hiçbir yere yazılmadı.");
}

main().catch((error) => {
  console.error(`\nHATA: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
