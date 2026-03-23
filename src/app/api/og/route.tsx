import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const truncate = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}...` : normalized;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = truncate(searchParams.get('title') || 'Saab Store', 70);
  const description = truncate(searchParams.get('description') || '', 150);
  const path = truncate(searchParams.get('path') || '/', 32);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, #0f0b02 0%, #1f1606 38%, #5f4717 100%)',
          color: '#f7e7bd',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at top right, rgba(224, 181, 74, 0.34), transparent 34%), radial-gradient(circle at bottom left, rgba(173, 120, 32, 0.22), transparent 30%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '420px',
            height: '420px',
            borderRadius: '999px',
            border: '1px solid rgba(247, 231, 189, 0.18)',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-180px',
            left: '-120px',
            width: '520px',
            height: '520px',
            borderRadius: '999px',
            border: '1px solid rgba(247, 231, 189, 0.14)',
            opacity: 0.5,
          }}
        />

        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '64px 72px',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase',
                  color: '#d8b15a',
                }}
              >
                Saab Store
              </div>
              <div
                style={{
                  fontSize: 18,
                  color: 'rgba(247, 231, 189, 0.82)',
                }}
              >
                Premium Jewelry & Gold
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                padding: '12px 18px',
                borderRadius: '999px',
                border: '1px solid rgba(216, 177, 90, 0.35)',
                background: 'rgba(15, 11, 2, 0.26)',
                color: '#f7e7bd',
                fontSize: 18,
                textTransform: 'uppercase',
              }}
            >
              {path}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '22px',
              maxWidth: '930px',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: '88px',
                height: '6px',
                borderRadius: '999px',
                background: '#d8b15a',
              }}
            />
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                lineHeight: 1.08,
                fontWeight: 700,
                color: '#fff8e1',
              }}
            >
              {title}
            </div>
            {description ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: 'rgba(247, 231, 189, 0.9)',
                  maxWidth: '980px',
                }}
              >
                {description}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: 'rgba(247, 231, 189, 0.72)',
              fontSize: 20,
            }}
          >
            <div style={{ display: 'flex' }}>Transparent pricing</div>
            <div style={{ display: 'flex' }}>Trusted gold pieces</div>
            <div style={{ display: 'flex' }}>Page-specific preview</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
