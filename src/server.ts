import Koa from "koa"
import Router from "@koa/router"
import bodyParser from "@koa/bodyparser"
import SubscribersDB, { Subscriber, SubscriberConsistency } from "./subscribers_db"
import EventDB, { SnallabotEvent } from "./event_db"
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

type QueryRequest = { key: string, event_types: string[] }

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
enum Delivery {
    EVENT_TRANSFER = "EVENT_TRANSFER",
    EVENT_SOURCE = "EVENT_SOURCE"
}
type PostSenderRequest = SnallabotEvent & { delivery: Delivery }
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
        const incomingEvent = ctx.request.body as PostSenderRequest
        ctx.status = 202
        await next()
        if (incomingEvent.delivery === "EVENT_SOURCE") {
            await eventDB.appendEvent(incomingEvent)
        }
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
    .post("/query", async (ctx) => {
        const queryReq = ctx.request.body as QueryRequest
        const events = await Promise.all(queryReq.event_types.map((event_type) => {
            return eventDB.queryEvents(queryReq.key, event_type).then(e => ({ [event_type]: e }))
        }))
        ctx.response.body = Object.assign({}, ...events)
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
