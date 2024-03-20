import Koa from "koa"
import Router from "@koa/router"
import bodyParser from "@koa/bodyparser"
import SubscribersDB, { Subscriber, SubscriberConsistency } from "./subscribers_db"

const app = new Koa()
const router = new Router()

type Event = { key: string, event_type: string, [key: string]: any }

const subcribersDB = SubscribersDB()

router.post("/subscribe", async (ctx) => {
    const req = ctx.request.body as Subscriber
    await subcribersDB.saveSubscriber(req)
})
    .del("/unsubscribe", async (ctx) => {
        const apiReq = ctx.request.body as { api: string }
        await subcribersDB.deleteSubscriber(apiReq.api)
    })
    .post("/post", async (ctx) => {
        const incomingEvent = ctx.request.body as Event
        const subscribers = await subcribersDB.query(incomingEvent.event_type)
        const strongConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.STRONG)
        const weakConsistency = subscribers.filter(s => s.consistency === SubscriberConsistency.WEAK)
        await Promise.all(weakConsistency.map(api => {
            fetch(api.api, {
                method: "POST",
                body: incomingEvent
            })
        }))

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
