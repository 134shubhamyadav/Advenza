import { config } from "../config/env.js";

async function verifyOutboundIps() {
  console.log("==============================================================");
  console.log("ADVENZA — OUTBOUND PUBLIC IP & BREVO GATEWAY VERIFICATION");
  console.log("==============================================================\n");

  const services = [
    { name: "api.ipify.org", url: "https://api.ipify.org?format=json", parser: (d) => JSON.parse(d).ip },
    { name: "ifconfig.me", url: "https://ifconfig.me/all.json", parser: (d) => JSON.parse(d).ip_addr },
    { name: "icanhazip.com", url: "https://icanhazip.com", parser: (d) => d.trim() },
    { name: "ipinfo.io", url: "https://ipinfo.io/json", parser: (d) => JSON.parse(d).ip },
  ];

  const results = {};
  for (const s of services) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(5000) });
      const raw = await res.text();
      const ip = s.parser(raw);
      results[s.name] = ip;
      console.log(`[${s.name.padEnd(16)}]: ${ip}`);
    } catch (err) {
      console.log(`[${s.name.padEnd(16)}]: ERROR (${err.message})`);
    }
  }

  // Live probe directly against Brevo API
  console.log("\n--- Probing Brevo API Gateway (api.brevo.com/v3/account) ---");
  const apiKey = (config.BREVO_API_KEY || "").trim();
  try {
    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    const status = res.status;
    const body = await res.text();
    console.log(`HTTP Status:   ${status} ${res.statusText}`);
    console.log(`Response Body: ${body}`);

    try {
      const parsed = JSON.parse(body);
      if (status === 200) {
        console.log("\n✅ Brevo API is 100% Authorized and Connected!");
      } else {
        const ipMatch = (parsed.message || "").match(/unrecognised IP address\s+([0-9.]+)/i)
          || (parsed.message || "").match(/unrecognized IP address\s+([0-9.]+)/i);
        if (ipMatch) {
          console.log(`\n❌ Brevo Gateway explicitly reports rejecting IP: ${ipMatch[1]}`);
        }
      }
    } catch (_) {}
  } catch (err) {
    console.log(`Brevo fetch error: ${err.message}`);
  }
}

verifyOutboundIps().catch(console.error);
