export default function AgreementsPage() {
  // Demo data — in production, fetch from Supabase
  const agreements = [
    { id: "1", clientName: "Sarah Johnson", signedDate: "2026-02-25", filming: true, waiver: true, terms: true },
    { id: "2", clientName: "Maria Lopez", signedDate: "2026-02-20", filming: false, waiver: true, terms: true },
    { id: "3", clientName: "Ashley Williams", signedDate: "2026-02-15", filming: true, waiver: true, terms: true },
    { id: "4", clientName: "Jessica Davis", signedDate: "2026-02-28", filming: false, waiver: true, terms: true },
  ];

  return (
    <div>
      <h1 className="font-display text-[28px] font-bold text-dark-brown mb-6">
        Signed Agreements
      </h1>

      <div className="bg-white rounded-surface shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        {agreements.map((agreement) => (
          <div
            key={agreement.id}
            className="flex items-center justify-between px-5 py-4 border-b border-light-tan last:border-b-0"
          >
            <div>
              <p className="font-sans text-[16px] font-semibold text-dark-brown">
                {agreement.clientName}
              </p>
              <p className="font-sans text-[12px] text-muted">
                Signed {agreement.signedDate}
              </p>
              <div className="flex gap-2 mt-1">
                {agreement.filming && (
                  <span className="text-[12px] font-semibold font-sans text-deep-brown bg-deep-brown/10 px-2 py-0.5 rounded-full">
                    Filming
                  </span>
                )}
                {agreement.waiver && (
                  <span className="text-[12px] font-semibold font-sans text-deep-brown bg-deep-brown/10 px-2 py-0.5 rounded-full">
                    Waiver
                  </span>
                )}
                {agreement.terms && (
                  <span className="text-[12px] font-semibold font-sans text-deep-brown bg-deep-brown/10 px-2 py-0.5 rounded-full">
                    Terms
                  </span>
                )}
              </div>
            </div>
            <button className="font-sans text-[16px] text-deep-brown font-semibold hover:underline cursor-pointer">
              View PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
