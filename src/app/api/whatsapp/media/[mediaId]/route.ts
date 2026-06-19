import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { getMediaUrl, downloadMedia } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { mediaId } = await params

    if (!mediaId) {
      return NextResponse.json(
        { error: 'Media ID is required' },
        { status: 400 }
      )
    }

    const ctx = await requireRole('viewer')

    const expectedMediaUrl = `/api/whatsapp/media/${mediaId}`
    const { data: ownedMessages, error: ownedMessageError } = await ctx.supabase
      .from('messages')
      .select('id')
      .eq('media_url', expectedMediaUrl)
      .limit(1)

    if (ownedMessageError || !ownedMessages?.length) {
      return NextResponse.json(
        { error: 'Media not found for this account' },
        { status: 404 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await createServiceRoleClient()
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .eq('account_id', ctx.accountId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Get the download URL from Meta
    const mediaInfo = await getMediaUrl({ mediaId, accessToken })

    // Download the binary data
    const { buffer, contentType } = await downloadMedia({
      downloadUrl: mediaInfo.url,
      accessToken,
    })

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          contentType || mediaInfo.mimeType || 'application/octet-stream',
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
