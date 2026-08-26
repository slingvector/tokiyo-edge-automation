package com.tokiyo.core.domain.interfaces

interface IMediaRelay {
    suspend fun downloadAndIndexMedia(url: String, fileName: String): Boolean
}
