import puppeteer from "puppeteer";
import * as fs from "fs";

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

  // await new Promise((resolve) => setTimeout(resolve, 3000));

  await page.waitForSelector("input", { waitUntil: 3000 });

  await page.click("input");
  await page.type("input", req, { delay: 200 });
  await page.keyboard.press("Enter");
  //   await page.keyboard.press("NumpadEnter");
  //   await page.keyboard.press("\n");

  await page.waitForSelector(".L1xEbb", { visible: true, timeout: 4000 });
  await page.click(".L1xEbb");

  await page.mouse.wheel({ deltaY: 1500 });

  await page.waitForSelector(".Nv2PK", { visible: true, timeout: 4000 });

  while (true) {
    await page.evaluate(() => {
      const scrollableElement = document.querySelector("#QA0Szd .QjC7t");
      if (scrollableElement) {
        // scrollableElement.scrollTop += 1500;
        scrollableElement.scrollBy(0, 1500);
      } else {
        console.log("Элемент прокрутки не найден");
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const elementExists = await page.$(".HlvSq");
    if (elementExists) {
      console.log("Элемент .HlvSq найден, прекращаем прокрутку.");
      break;
    }
  }

  // Получаем список элементов
  const findList = await page.$$(".Nv2PK");
  console.log("////////////////////////", findList.length);

  const elementsArray = Array.from(findList);
  
  for (let li of elementsArray) {
    const elementHandle = await li.evaluateHandle((el) => el);
    // const elementId = await page.evaluate((el) => el.outerHTML, elementHandle);
    await li.click();
    const element = await page.waitForSelector(
      "#QA0Szd div.w6VYqd > div.Hu9e2e.tTVLSc > div > div.e07Vkf.kA9KIf > div > div > div.XiKgde",
      { visible: true, timeout: 4000 })

      const data = await page.evaluate((el) => {
        const name = el.querySelector("h1")
        const adress = el.querySelector("[data-item-id='address']")
        const website = el.querySelector("[data-item-id='authority']")
        const phone = el.querySelector("[data-item-id^='phone:tel:']")
        return {
          name: name ? name.innerText : "",
          adress: adress ? adress.innerText : "",
          website: website ? website.href : "",
          phone: phone ? phone.getAttribute("data-item-id").replace("phone:tel:", "") : ""
        }
      }, element)
     
      fs.appendFileSync("data.json", JSON.stringify(data) + "\n", (err) => {if(err) throw err})    
  }
};

const request = process.argv.slice(2).join(" ") || "Рестораны Казани";
mapsParser(request);

// while (true) {
//   const findList = await page.$$(".Nv2PK");

//   let newElementFound = false;
//   i++;
//   for (let li of findList) {
//     const elementHandle = await li.evaluateHandle((el) => el);
//     const elementId = await page.evaluate(
//       (el) => el.outerHTML,
//       elementHandle
//     );

//     if (!clickedElements.has(elementId)) {
//       await li.click();
//       clickedElements.add(elementId);
//       newElementFound = true;
//       clickCount++; // Увеличиваем счетчик кликов

//       console.log(
//         "Кликнули на элемент:",
//         await page.evaluate((el) => el.innerText, li),
//         clickedElements.size
//       );

//       // Прокручиваем страницу после каждых 5 кликов
//       if (clickCount % 5 === 0) {
//         await page.evaluate(() => window.scrollBy(0, 1600));
//         await new Promise((resolve) => setTimeout(resolve, 4000)); // Ждем загрузки новых элементов
//       }

//       break; // Выходим из цикла, чтобы кликнуть на следующий элемент
//     }
//   }

//   if (!newElementFound) {
//     console.log("Все элементы были кликнуты.");
//     break;
//   }
// }

// await browser.close();
// };
