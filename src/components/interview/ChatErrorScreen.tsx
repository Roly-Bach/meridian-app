export function ChatErrorScreen({ type }: { type: 'not_found' | 'expired' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="text-center max-w-[400px] px-6">
        <div className="w-12 h-12 rounded-full bg-[#FEE2E2] flex items-center justify-center mx-auto mb-4 text-[20px]">
          ⚠
        </div>
        <p className="text-[18px] font-semibold text-[#111111] mb-2">
          {type === 'not_found'
            ? 'Dieser Interview-Link ist ungültig.'
            : 'Dieser Interview-Link ist nicht mehr gültig.'}
        </p>
        <p className="text-[14px] text-[#6B7280]">
          {type === 'not_found'
            ? 'Bitte prüfen Sie den Link oder wenden Sie sich an Ihren Ansprechpartner.'
            : 'Der Link ist abgelaufen. Wenden Sie sich an Ihren Ansprechpartner für einen neuen Link.'}
        </p>
        <p className="text-[12px] text-[#E040FB] mt-8 font-medium tracking-wide">Meridian</p>
      </div>
    </div>
  )
}
