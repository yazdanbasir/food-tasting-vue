/**
 * usePlacardExport — composable for exporting placard(s) as PDF or PNG.
 *
 * Both html2canvas-pro and jspdf are DYNAMICALLY IMPORTED at call time so they
 * never bloat the initial app bundle.
 *
 * Flow:
 *  1. Create a hidden container in <body>.
 *  2. For each submission, mount a PlacardRenderer into the container.
 *  3. Capture the rendered DOM with html2canvas at 2× scale.
 *  4. Add to jsPDF page (PDF) or trigger a file download (PNG).
 *  5. Destroy the Vue app instance & clean up the container.
 */
import { ref, createApp, type App as VueApp } from 'vue'
import type { SubmissionResponse } from '@/api/submissions'
import PlacardRenderer from '@/components/PlacardRenderer.vue'

/** Format current date-time as MM_DD_YYYY_HH_MM */
function dateTimeSuffix(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${now.getFullYear()}_${pad(now.getHours())}_${pad(now.getMinutes())}`
}

/** Sanitise a dish name for use in a filename */
function safeDishName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

export function usePlacardExport() {
  const isExporting = ref(false)
  const exportProgress = ref('')

  /**
   * Mount PlacardRenderer for a single submission into a hidden container,
   * wait for images to load, capture with html2canvas, then tear down.
   */
  async function renderToCanvas(
    sub: SubmissionResponse,
    html2canvas: typeof import('html2canvas-pro')['default'],
  ): Promise<HTMLCanvasElement> {
    // Create a host element positioned off-screen
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;z-index:-1;pointer-events:none;'
    document.body.appendChild(host)

    // Mount a mini Vue app for PlacardRenderer
    const mountEl = document.createElement('div')
    host.appendChild(mountEl)

    let app: VueApp | null = null
    try {
      app = createApp(PlacardRenderer, { submission: sub })
      app.mount(mountEl)

      // Give the browser a frame to render (and load the ISA logo)
      await new Promise((r) => setTimeout(r, 200))

      // Wait for any <img> inside the placard to finish loading
      const imgs = host.querySelectorAll('img')
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) return resolve()
              img.onload = () => resolve()
              img.onerror = () => resolve()
            }),
        ),
      )

      // Find the .placard-page element (root of the placard)
      const placardEl =
        host.querySelector('.placard-page') as HTMLElement | null
      if (!placardEl) throw new Error('PlacardRenderer did not render')

      const canvas = await html2canvas(placardEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      return canvas
    } finally {
      if (app) app.unmount()
      document.body.removeChild(host)
    }
  }

  /** Export selected submissions as a single multi-page PDF (landscape A4). */
  async function exportPDF(submissions: SubmissionResponse[]) {
    if (!submissions.length) return
    isExporting.value = true
    exportProgress.value = 'Loading export libraries…'

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = 297
      const pageH = 210

      for (const [i, sub] of submissions.entries()) {
        exportProgress.value = `Generating placard ${i + 1} of ${submissions.length}…`
        const canvas = await renderToCanvas(sub, html2canvas)

        const imgData = canvas.toDataURL('image/png')
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
      }

      exportProgress.value = 'Saving PDF…'
      const ts = dateTimeSuffix()
      const firstSubmission = submissions[0]
      const pdfName = submissions.length === 1 && firstSubmission
        ? `${safeDishName(firstSubmission.dish_name)}_${ts}.pdf`
        : `placards_${ts}.pdf`
      pdf.save(pdfName)
    } catch (err) {
      console.error('PDF export failed', err)
      throw err
    } finally {
      isExporting.value = false
      exportProgress.value = ''
    }
  }

  /** Export selected submissions as individual PNG downloads. */
  async function exportPNG(submissions: SubmissionResponse[]) {
    if (!submissions.length) return
    isExporting.value = true
    exportProgress.value = 'Loading export libraries…'

    try {
      const { default: html2canvas } = await import('html2canvas-pro')

      for (const [i, sub] of submissions.entries()) {
        exportProgress.value = `Generating placard ${i + 1} of ${submissions.length}…`
        const canvas = await renderToCanvas(sub, html2canvas)

        // Convert canvas to blob and download
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
            'image/png',
          )
        })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${safeDishName(sub.dish_name)}_${dateTimeSuffix()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        // Brief pause between downloads so browser doesn't block them
        if (i < submissions.length - 1) {
          await new Promise((r) => setTimeout(r, 300))
        }
      }
    } catch (err) {
      console.error('PNG export failed', err)
      throw err
    } finally {
      isExporting.value = false
      exportProgress.value = ''
    }
  }

  return { isExporting, exportProgress, exportPDF, exportPNG }
}
