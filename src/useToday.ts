import { useEffect, useState } from 'react'

export function useToday(getToday: () => string) {
  const [today, setToday] = useState(getToday)
  useEffect(() => {
    let timer: number
    const update = () => {
      setToday(getToday())
      window.clearTimeout(timer)
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      timer = window.setTimeout(update, midnight.getTime() - Date.now() + 100)
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', update) }
  }, [getToday])
  return today
}
