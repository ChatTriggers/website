package com.chattriggers.website

import com.chattriggers.website.api.makeApiRoutes
import com.chattriggers.website.api.makeCompatRoutes
import com.chattriggers.website.config.Config
import com.chattriggers.website.data.DB
import com.chattriggers.website.data.Webhook
import io.javalin.Javalin
import io.javalin.http.staticfiles.Location
import org.eclipse.jetty.server.Connector
import org.eclipse.jetty.server.Server
import org.eclipse.jetty.server.ServerConnector
import org.eclipse.jetty.util.ssl.SslContextFactory
import org.koin.core.context.startKoin
import org.koin.dsl.module
import java.io.File

// Where all of our configuration is managed.
// Making this injected allows for testing with fake db configurations.
val configModule = module {
    single { Config.db }
    single { Config.mail }
    single { Config.discord }
}

fun main(args: Array<String>) {
    startKoin {
        modules(listOf(configModule))
    }

    DB.setupDB()
    Webhook.setupWebhook()

    val production = args.any { it == "--production" }

    val app = Javalin.create {
        Sessions.configure(it)
        Auth.configure(it)

        if (!production) {
            it.enableDevLogging()
            it.enableCorsForAllOrigins()
        }

        it.addStaticFiles("static/home/", Location.EXTERNAL)
        it.addStaticFiles("static/frontend/", Location.EXTERNAL)
        it.addStaticFiles("assets", Location.CLASSPATH)
        it.addSinglePageRoot("/modules", "static/frontend/index.html", Location.EXTERNAL)
    }.start(if (production) 80 else 7000)

    makeApiRoutes(app)
    makeCompatRoutes(app)
}
