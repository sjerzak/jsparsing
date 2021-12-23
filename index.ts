import { parseString, Builder } from "xml2js"
const saxpath = require("saxpath")
import path = require("path")
import sax = require("sax")
import { appendFile, createReadStream } from "fs"

const saxParser = sax.createStream(true)
const streamer = new saxpath.SaXPath(saxParser, "//offer")
const builder = new Builder({
  headless: true,
})

const now: Date = new Date()
let openTime: Date = new Date()
let midnight: Date = new Date()
let closeTime: Date = new Date()
const todayDay: number = now.getDay()
let pausedCounter: number = 0
let activeCounter: number = 0

midnight.setHours(0)
midnight.setMinutes(0)

appendFile(
  "./test.xml",
  `<?xml version="1.0" encoding="UTF-8" ?>\n<offers>\n`,
  function (err) {
    if (err) console.log(err)
  }
)

const jsToXmlFile = (filename: string, obj: object, cb: any) => {
  const filepath: string = path.normalize(path.join(__dirname, filename))
  let xml: string = builder.buildObject(obj)
  xml = xml.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  appendFile(filepath, xml, cb)
}

const setTimes = (activeTimes: { opening: string; closing: string }) => {
  if (activeTimes) {
    closeTime.setHours(Number(activeTimes.closing.split(":")[0]))
    closeTime.setMinutes(Number(activeTimes.closing.split(":")[1]))
    openTime.setHours(Number(activeTimes.opening.split(":")[0]))
    openTime.setMinutes(Number(activeTimes.opening.split(":")[1]))
  }
}

const opened: Function = () => {
  if (
    (now.getTime() > openTime.getTime() &&
      now.getTime() < closeTime.getTime()) ||
    (now.getTime() > openTime.getTime() &&
      closeTime.getTime() == midnight.getTime())
  ) {
    return true
  }
}

const getOpeningTimes: Function = (result: {
  offer: { opening_times: string }
}) => {
  const openingTimes = result.offer.opening_times
  const openingTimesClean = openingTimes[0].substring(9).slice(0, -3)
  let myObj = JSON.parse(openingTimesClean)
  delete myObj.timezone
  return myObj
}

streamer.on("match", function (xml: File) {
  parseString(xml, function (err, result) {
    const myObj: { [key: string]: [{ opening: string; closing: string }] } =
      getOpeningTimes(result)
    if (typeof myObj[todayDay] != "undefined" && myObj[todayDay].length) {
      setTimes(myObj[todayDay][0])
      if (opened()) {
        result.offer.is_active = ["<![CDATA[true]]>"]
        activeCounter++
      } else {
        result.offer.paused = ["<![CDATA[true]]>"]
        pausedCounter++
      }
    } else {
      result.offer.paused = ["<![CDATA[true]]>"]
      pausedCounter++
    }
    jsToXmlFile("test.xml", result, function (err: Error) {
      if (err) console.log(err)
    })
  })
})

streamer.on("end", function () {
  console.log("Opened ", activeCounter, "Paused", pausedCounter)
  appendFile("./test.xml", `\n</offers>`, function (err) {
    if (err) console.log(err)
  })
})

createReadStream("feed_sample.xml").pipe(saxParser)
