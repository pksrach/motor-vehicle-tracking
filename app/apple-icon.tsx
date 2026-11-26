import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0ad4e',
      }}
    >
      <svg width="112" height="112" viewBox="0 0 64 64" fill="none">
        <path d="M12 44a20 20 0 1 1 40 0" stroke="#20232b" strokeLinecap="round" strokeWidth="5" />
        <path d="m32 34 11-11" stroke="#20232b" strokeLinecap="round" strokeWidth="5" />
        <circle cx="32" cy="34" r="4" fill="#20232b" />
      </svg>
    </div>,
    size,
  )
}
