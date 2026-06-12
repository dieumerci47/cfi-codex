import { format, isToday, isYesterday } from 'date-fns'

/**
 * Horodatage court et concret : l'heure si c'est aujourd'hui (« 11:35 »),
 * « Hier » sinon, et la date courte au-delà (« 11/06/25 »).
 * Utilisé partout (messages, posts, commentaires) au lieu du relatif flou.
 */
export function shortTime(d) {
  const date = new Date(d)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Hier'
  return format(date, 'dd/MM/yy')
}
