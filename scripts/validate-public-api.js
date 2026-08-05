const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

function checkFile(relativePath, patterns) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, "utf8");
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      failures.push(`${relativePath}: contains unpublished API reference ${pattern}`);
    }
  }
}

const unpublishedReferences = [
  /\/(?:api\/v1\/)?responses\b/i,
  /\bvenice[-_]responses\b/i,
  /\bresponses\.(?:create|stream)\(\)/i,
];

for (const file of ["agents.md", "skill.md", "llms.txt", "llms-full.txt"]) {
  checkFile(file, unpublishedReferences);
}

checkFile("swagger.yaml", [
  /^  \/responses:$/m,
  /^    Responses(?:Request|Response):$/m,
]);

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  const prefix = entry.isDirectory() && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(entry.name)
    ? `${entry.name}/`
    : "";
  if (entry.name !== "guides" && !prefix) continue;

  const guidesRoot = prefix ? `${prefix}guides` : "guides";
  for (const file of [
    "integrations/x402-venice-api.mdx",
    "integrations/venice-skills.mdx",
    "integrations/venice-mcp.mdx",
  ]) {
    checkFile(`${guidesRoot}/${file}`, unpublishedReferences);
  }

  const structuredPath = `${guidesRoot}/features/structured-responses.mdx`;
  const fullStructuredPath = path.join(root, structuredPath);
  if (fs.existsSync(fullStructuredPath)) {
    const content = fs.readFileSync(fullStructuredPath, "utf8");
    if (!content.includes("/chat/completions") || !content.includes("response_format")) {
      failures.push(`${structuredPath}: must identify response_format on /chat/completions`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Public API inventories contain only published routes.");
