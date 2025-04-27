package com.chattriggers.website.config

object Config {
    val web = WebConfig(System.getenv("PORT")?.toIntOrNull() ?: 7000)

    val db: DbConfig = DbConfig(
        System.getenv("DATABASE_URL"),
        System.getenv("DATABASE_USERNAME"),
        System.getenv("DATABASE_PASSWORD"),
    )

    val mail: MailConfig = MailConfig(
        System.getenv("MAIL_API_KEY"),
        System.getenv("MAIL_FROM"),
    )

    val discord: DiscordConfig = DiscordConfig(
        System.getenv("DISCORD_VERIFY_WEBHOOK"),
        System.getenv("DISCORD_MODULES_WEBHOOK"),
        System.getenv("DISCORD_ALERTS_WEBHOOK"),
    )

    val cloudflare: CloudflareConfig = CloudflareConfig(
        System.getenv("CLOUDFLARE_ZONE_ID"),
        System.getenv("CLOUDFLARE_EMAIL"),
        System.getenv("CLOUDFLARE_API_TOKEN"),
    )
}

class WebConfig(val port: Int)

class DbConfig(val jdbcUrl: String, val username: String, val password: String)

class MailConfig(val sendgridKey: String, val fromEmail: String)

class DiscordConfig(val verifyWebhook: String, val modulesWebhook: String, val alertsWebhook: String)

class CloudflareConfig(val zoneId: String, val email: String, val apiToken: String)
