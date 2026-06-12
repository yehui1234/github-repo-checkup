const { createServer } = require("../server");
const { createMockFetch } = require("../test/fixtures");

const port = Number(process.env.PORT) || 3100;
createServer({
  fetchImpl: createMockFetch(),
  deepseekApiKey: "browser-test-key"
}).listen(port, "127.0.0.1", () => {
  console.log(`Browser test server running at http://127.0.0.1:${port}`);
});
