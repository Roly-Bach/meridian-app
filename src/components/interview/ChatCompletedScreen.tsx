export function ChatCompletedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="text-center max-w-[400px] px-6">
        <div className="w-12 h-12 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4 text-[20px]">
          ✓
        </div>
        <p className="text-[18px] font-semibold text-[#111111] mb-2">
          Vielen Dank! Das Interview wurde abgeschlossen.
        </p>
        <p className="text-[14px] text-[#6B7280]">
          Ihre Angaben wurden gespeichert. Sie können dieses Fenster schließen.
        </p>
        <p className="text-[12px] text-[#E040FB] mt-8 font-medium tracking-wide">Meridian</p>
      </div>
    </div>
  )
}
