import Koa from "koa"
import Router from "@koa/router"
import bodyParser from "@koa/bodyparser"
import SubscribersDB, { Subscriber, SubscriberConsistency } from "./subscribers_db"
import EventDB, { SnallabotEvent, StoredEvent } from "./event_db"
import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore, Firestore } from "firebase-admin/firestore"


const app = new Koa()
const router = new Router()

function setupFirebase() {
    // production, use firebase with SA credentials passed from environment
    if (process.env.SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT)
        initializeApp({
            credential: cert(serviceAccount)
        })

    }
    // dev, use firebase emulator
    else {
        if (!process.env.FIRESTORE_EMULATOR_HOST) {
            throw new Error("Firestore emulator is not running!")
        }
        initializeApp({ projectId: "dev" })
    }
    return getFirestore()
}

const db: Firestore = setupFirebase()
const subcribersDB = SubscribersDB(db)
const eventDB = EventDB(db)

async function retryingPromise(future: () => Promise<Response>, maxTries: number = 5): Promise<Response> {
    let count = 0
    while (count < maxTries) {
        const res = await future()
        if (res.ok) {
            return res
        } else {
            count = count + 1
        }
    }
    throw Error("Failed to post event")
}

router.post("/subscribe", async (ctx) => {
    const req = ctx.request.body as Subscriber
    await subcribersDB.saveSubscriber(req)
    ctx.status = 200
})
    .post("/unsubscribe", async (ctx) => {
        const apiReq = ctx.request.body as { api: string }
        await subcribersDB.deleteSubscriber(apiReq.api)
        ctx.status = 200
    })
    .post("/post", async (ctx, next) => {
        const incomingEvent = ctx.request.body as SnallabotEvent
        ctx.status = 202
        await next()
        await eventDB.appendEvent(incomingEvent)
        const subscribers = await subcribersDB.query(incomingEvent.event_type)
        const strongConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.STRONG)
        const weakConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.WEAK)
        weakConsistency.map(api =>
            fetch(api.api, {
                method: "POST",
                body: JSON.stringify(incomingEvent)
            })
        )
        await Promise.all(strongConsistency.map(api => retryingPromise(() => fetch(api.api, {
            method: "POST",
            body: JSON.stringify(incomingEvent)
        }))))
    })


app.use(bodyParser({ enableTypes: ["json"], encoding: "utf-8" }))
    .use(async (ctx, next) => {
        try {
            await next()
        } catch (err: any) {
            console.error(err)
            ctx.status = 500;
            ctx.body = {
                message: err.message
            };
        }
    })
    .use(router.routes())
    .use(router.allowedMethods())

export default app
