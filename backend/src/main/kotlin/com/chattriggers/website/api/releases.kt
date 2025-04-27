package com.chattriggers.website.api

import com.chattriggers.website.config.Config
import com.chattriggers.website.data.Module
import com.chattriggers.website.data.Webhook
import com.fasterxml.jackson.core.Version
import com.fasterxml.jackson.databind.ObjectMapper
import com.sendgrid.Client
import com.sendgrid.Method
import com.sendgrid.Request
import io.javalin.apibuilder.ApiBuilder.crud
import io.javalin.apibuilder.ApiBuilder.get
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.concurrent.thread

fun releaseRoutes() {
    val releaseController = ReleaseController()
    crud("modules/{module-id}/releases/{release-id}", releaseController)
    get("modules/{module-id}/releases/{release-id}/verify", releaseController::verify)
}

fun getReleaseForModVersion(module: Module, modVersionString: String) = transaction {
    val modVersion = modVersionString.toVersion()

    module.releases
        .asSequence()
        .filter { it.verified }
        .sortedByDescending { it.releaseVersion.toVersion() }
        .distinctBy { it.modVersion }
        .map { it to it.modVersion.toVersion() }
        .sortedByDescending { it.second }
        .firstOrNull { it.second.majorVersion <= modVersion.majorVersion }
        ?.first
}

fun String.toVersion(): Version {
    val (semvar, extra) = if ('-' in this) {
        split('-')
    } else listOf(this, null)

    val split = semvar!!.split(".").map(String::toInt)
    return Version(split[0], split[1], split[2], extra, null, null)
}

fun invalidateReleases(module: Module) {
    thread {
        sendInvalidationRequest(module)
    }
}

private fun sendInvalidationRequest(module: Module, retryCount: Long = 0) {
    if (retryCount >= 3) {
        return
    }

    val client = Client()
    val request = Request().apply {
        val config = Config.cloudflare

        baseUri = "api.cloudflare.com"
        endpoint = "/client/v4/zones/${config.zoneId}/purge_cache"
        method = Method.POST

        addHeader("Content-Type", "application/json")
        addHeader("Authorization", "Bearer ${config.apiToken}")

        val prefix = "chattriggers.com/api/modules/${module.name}"
        val request = CloudflarePurgeRequest(listOf(prefix, "www.$prefix"))
        val objectMapper = ObjectMapper()
        body = objectMapper.writeValueAsString(request)
    }

    var errorMessage: String? = null
    try {
        val response = client.api(request)
        if (response.statusCode != 200) {
            errorMessage = "Failed to purge cache for module ${module.name}: status=${response.statusCode}, body=${response.body}"
        }
    } catch (e: Exception) {
        errorMessage = "Failed to purge cache for module ${module.name}: ${e.message}"
        e.printStackTrace()
    }

    if (errorMessage != null) {
        Webhook.sendAlert("Module Invalidation Error", errorMessage)
        Thread.sleep(60 * 1000 * (retryCount + 1))
        sendInvalidationRequest(module, retryCount + 1)
    }
}

data class CloudflarePurgeRequest(val prefixes: List<String>)