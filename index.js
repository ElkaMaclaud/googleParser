import puppeteer from "puppeteer";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  // await page.setUserAgent(
  //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  //   );

  await page.goto("https://www.google.ru/maps", {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await page.setViewport({ width: 1480, height: 1000 });
  await page.screenshot({ path: "example.png" });

  new Promise((resolve) => setTimeout(resolve, 3000));

  await page.waitForSelector("input", { waitUntil: 3000 });

  await page.click("input");
  await page.type("input", req, { delay: 200 });
  await page.keyboard.press("Enter");
//   await page.keyboard.press("NumpadEnter"); 
//   await page.keyboard.press("\n");
//   await page.keyboard.press("\r"); 


};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);
