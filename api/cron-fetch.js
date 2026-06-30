// DIAGNOSTIC BUILD — no imports, no logic, just confirms the function loads.
export default function handler(req, res) {
  res.status(200).json({ ok: true, message: "Hello World" });
}
