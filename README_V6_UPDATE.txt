PREPONE V6 RESOURCE WORKSPACE
============================

Main fixes:
- Removed the Syllabus Notes column from the V6 workbook.
- Active stays in K.
- MCQ Quiz is in L and always appears LAST in topic resources.
- M onward are dynamic resource URL columns.
- Backend scans every populated non-metadata URL column, so newly-added resource columns are fetched without code changes.
- Frontend merges backend ResourceLinks, dynamic topic fields and the legacy Resources sheet, then de-duplicates URLs.
- Empty URL cells are never shown.
- Clear but compact separation between syllabus topics.
- Premium accordion UI remains collapsed by default for long study sessions.
- YouTube uses privacy-enhanced youtube-nocookie embeds.
- Sandboxed web/MCQ frames block pop-ups and top-page redirects.

LIMITATION: YouTube advertisements shown inside YouTube's own embedded player cannot be reliably blocked by PrepOne. Use direct/hosted videos if guaranteed ad-free playback is required.
