import puppeteer from "puppeteer";
import * as fs from "fs";

const mapsParser = async (req) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.google.ru/maps", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await page.setViewport({ width: 1480, height: 1000 });

    await page.waitForSelector("input", {
      waitUntil: "visible",
      timeout: 3000,
    });

    await page.click("input");
    await page.type("input", req, { delay: 200 });
    await page.keyboard.press("Enter");

    await page.waitForSelector(".L1xEbb", { visible: true, timeout: 2000 });
    await page.click(".L1xEbb");

    await page.mouse.wheel({ deltaY: 1500 });

    await page.waitForSelector(".Nv2PK", { visible: true, timeout: 2000 });

    const allData = { data: [] };
    const uniqueData = new Set();
    let filteredArr = [];

    let startIndex = 0

    while (true) {
      const findList = await page.$$(".Nv2PK");
      const filteredArr = Array.from(findList).slice(startIndex)
      startIndex += findList.length

      if (!filteredArr.length) {
        break;
      }

      for (let i = 0; i < filteredArr.length; i++) {
        const li = filteredArr[i];
        let clickSuccess = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (await page.evaluate((element) => element.isConnected, li)) {
              await new Promise((resolve) => setTimeout(resolve, 3500));
              await li.click();
              clickSuccess = true;
              break;
            } else {
              const id = await page.evaluate((element) => {
                const el = element.querySelector(".hfpxzc");
                const value = el.getAttribute("aria-label")
                  ? el.getAttribute("aria-label").split("·")[0]
                  : "";
                return value;
              }, li);
              console.warn(
                "Элемент больше не находится в DOM-дереве, пропускаем его.",
                id
              );
            }
          } catch (error) {
            console.error("Ошибка при КЛИКЕ на элемент:", error);
            if (attempt === 2) {
              console.error("Не удалось кликнуть на элемент после 3 попыток.");
            }
          }
        }
        if (clickSuccess) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const element =  await page.waitForSelector(
            "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
            { visible: true, timeout: 2000 }
          );

          if (element) {
            const result = await page.evaluate((el) => {
              const name = el.querySelector("h1");
              const adress = el.querySelector("[data-item-id='address']");
              const website = el.querySelector("[data-item-id='authority']");
              const phone = el.querySelector("[data-item-id^='phone:tel:']");
              return {
                name: name ? name.innerText : "",
                adress: adress ? adress.innerText : "",
                website: website ? website.href : "",
                phone: phone
                  ? phone.getAttribute("data-item-id").replace("phone:tel:", "")
                  : "",
              };
            }, element);

            const uniqueKey =
              result.name + result.adress + result.website + result.phone;
            if (!uniqueData.has(uniqueKey)) {
              uniqueData.add(uniqueKey);
              allData.data.push(result);
            } else {
              const id = await page.evaluate((element) => {
                const el = element.querySelector(".hfpxzc");
                const value = el.getAttribute("aria-label")
                  ? el.getAttribute("aria-label").split("·")[0]
                  : "";
                return value;
              }, li);
              console.log("|||||||||||||||||||||||", uniqueData.size, id, "\n", uniqueKey)
            }
          } else {
            const id = await page.evaluate((element) => {
              const el = element.querySelector(".hfpxzc");
              const value = el.getAttribute("aria-label")
                ? el.getAttribute("aria-label").split("·")[0]
                : "";
              return value;
            }, li);
            console.log("НЕТ ЭЛЕМЕНТА", id)
          }
        } else {
          const id = await page.evaluate((element) => {
            const el = element.querySelector(".hfpxzc");
            const value = el.getAttribute("aria-label")
              ? el.getAttribute("aria-label").split("·")[0]
              : "";
            return value;
          }, li);
          console.log("clickSuccess = false   НЕТ ЭЛЕМЕНТА", id)
        }
      }

      await page.evaluate(() => {
        const elScr = document.querySelector("#QA0Szd .QjC7t");
        if (elScr) {
          elScr.scrollBy(0, 1500);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("allData.data.length:  ", allData.data.length);
    fs.writeFile(
      `${req.split(" ").join("_")}.db.json`,
      JSON.stringify(allData, null, 2),
      (err) => {
        if (err) throw err;
      }
    );
  } catch (error) {
    console.error("Ошибка в процессе парсинга:", error);
  } finally {
    await browser.close();
  }
};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);
