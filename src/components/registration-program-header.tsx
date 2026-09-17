import { BrandEmblem } from "./site-header";

/**
 * Reusable Top Program Header for EVERY Public Registration & Success page.
 *
 * Visual hierarchy:
 * 1. ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા (Dark Teal, Medium/Small)
 * 2. સુશાસનના ૨૫ વર્ષની ઉજવણીના ભાગરૂપે (Dark Gray, Slightly Smaller)
 * 3. “સેવા સંકલ્પ અભિયાન” (Warm Orange/Saffron, Highlighted, Semibold/Bold)
 * 4. અંતર્ગત (Small, Muted Gray)
 * 5. યોગ અને ધ્યાન શિબિર (Largest Heading, Dark Teal, Bold)
 *
 * Standalone: Non-clickable, no navigation links, no menus.
 * Responsive: Optimized for 360px, 390px, 412px, tablet and desktop.
 */
export function RegistrationProgramHeader() {
  return (
    <header className="w-full bg-[#FAF8F5] border-b border-[#E8E0D5] select-none">
      {/* Subtle Top Indian Tricolor Accent Line */}
      <div className="h-1 sm:h-1.5 w-full flex" aria-hidden="true">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white" />
        <div className="w-1/3 bg-[#138808]" />
      </div>

      {/* Official Government Program Announcement Block */}
      <div className="mx-auto max-w-3xl px-3.5 py-3.5 sm:py-5 text-center">
        {/* Official GSYB Emblem - Centered & Strictly Non-Clickable */}
        <div className="flex justify-center mb-2 sm:mb-2.5">
          <BrandEmblem className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 select-none pointer-events-none drop-shadow-xs" />
        </div>

        {/* 5-Line Gujarati Typography Hierarchy */}
        <div className="space-y-1 sm:space-y-1.5 font-gujarati">
          {/* Line 1: Official Authority */}
          <div className="text-[13px] sm:text-[15px] md:text-[16px] font-semibold text-[#0F3E3E] tracking-normal leading-snug">
            ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા
          </div>

          {/* Line 2: Supporting Sub-headline */}
          <div className="text-[11.5px] sm:text-[13px] md:text-[14px] font-medium text-[#4B5563] leading-snug">
            સુશાસનના ૨૫ વર્ષની ઉજવણીના ભાગરૂપે
          </div>

          {/* Line 3: Campaign Title (Warm Orange/Saffron Highlight) */}
          <div className="text-[17px] sm:text-[20px] md:text-[22px] font-bold text-[#EA580C] tracking-wide leading-snug">
            “સેવા સંકલ્પ અભિયાન”
          </div>

          {/* Line 4: Small Connective Text */}
          <div className="text-[11px] sm:text-[12px] md:text-[12.5px] font-normal text-[#6B7280] leading-snug">
            અંતર્ગત
          </div>

          {/* Line 5: Main Program Title (Largest Heading, Dark Teal) */}
          <h1 className="text-[23px] sm:text-[30px] md:text-[36px] font-extrabold text-[#0F3E3E] tracking-tight leading-tight pt-0.5">
            યોગ અને ધ્યાન શિબિર
          </h1>
        </div>
      </div>
    </header>
  );
}

// Alias for existing imports
export { RegistrationProgramHeader as RegistrationHeader };
