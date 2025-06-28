export default function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Urban Woodspace AI Backend</h1>
      <p>AI Kitchen Designer API is running successfully!</p>
      <div style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
        <h2>API Endpoints:</h2>
        <ul>
          <li>
            <code>POST /api/ai-design-visual</code> - AI Kitchen Design Generator
          </li>
        </ul>
        <p>
          <strong>Status:</strong> ✅ Active
        </p>
        <p>
          <strong>CORS:</strong> Configured for urbanwoodspace.com
        </p>
      </div>
    </div>
  )
}
