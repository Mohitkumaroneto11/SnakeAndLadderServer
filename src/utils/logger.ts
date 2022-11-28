import { configure, getLogger } from "log4js";


// configure({
//   appenders: { cheese: { type: "file", filename: "cheese.log" } },
//   categories: { default: { appenders: ["cheese"], level: "error" } }
// });

export async function setupLogger() {
  const LOG_DIR = process.env.LOG_DIR || "./logs"
  // if(!fs.existsSync(LOG_DIR)){
  //     await fs.promises.mkdir(LOG_DIR)
  // }

  // configure({
  //     appenders: {
  //       console: { type: 'stdout', layout: { type: 'colored' } },
  //       dateFile: {
  //         type: 'dateFile',
  //         filename: `${LOG_DIR}/${process.env.LOG_FILE}`,
  //         layout: { type: 'basic' },
  //         compress: true,
  //         daysToKeep: 14,
  //         keepFileExt: true
  //       }
  //     },
  //     categories: {
  //       default: { appenders: ['console', 'dateFile'], level: process.env.LOG_LEVEL }
  //     }
  //   });
  configure({
    appenders: {
      everything: {
        type: 'multiFile', base: 'logs/', property: 'gameId', extension: '.log',
        maxLogSize: 10485760, backups: 3, compress: true
      }
    },
    categories: {
      default: { appenders: ['everything'], level: process.env.LOG_LEVEL }
    }
  });
  // configure(LOG_DIR);


}

let paused = false;
process.on("log4js:pause", (value) => paused = value);

export const gameLog = (gameId: string, ...args: any) => {
  if (!paused) {
    const userLogger = getLogger('game');
    userLogger.addContext('gameId', gameId);
    const logs = args.map((val: any) => {
      try {
        let log = JSON.stringify(val);
        return log == '{}' ? val : log
      } catch (err) {
        return val;
      }

    })
    userLogger.info('', ...logs);
  }
}
