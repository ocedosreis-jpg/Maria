export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(
    JSON.stringify({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    })
  );
}
