import { useQuery } from '@tanstack/react-query';
import { must, supabase } from '../../lib/supabase';
import type { Advance, Booking } from '../../lib/types';

/** Bookings between two days (all statuses), with their advances. */
export function useBookings(from: string, to: string) {
  return useQuery({
    queryKey: ['bookings', from, to],
    queryFn: async () => {
      const bookings = must(await supabase.from('appointments').select('*').gte('day', from).lte('day', to)
        .order('day').order('start_time')) as Booking[];
      const ids = bookings.map((b) => b.id);
      const advances = ids.length
        ? must(await supabase.from('appointment_advances').select('*').in('appointment_id', ids).order('created_at')) as Advance[]
        : [];
      return { bookings, advances };
    },
  });
}

/** One booking and its advances (to start a salon entry from it). */
export function useBooking(id: string | null) {
  return useQuery({
    queryKey: ['booking', id],
    enabled: !!id,
    queryFn: async () => {
      const [b, a] = await Promise.all([
        supabase.from('appointments').select('*').eq('id', id!).single(),
        supabase.from('appointment_advances').select('*').eq('appointment_id', id!).order('created_at'),
      ]);
      return { booking: must(b) as Booking, advances: must(a) as Advance[] };
    },
  });
}

export const advancePaid = (advances: Advance[], bookingId: string) =>
  advances.filter((a) => a.appointment_id === bookingId && !a.voided).reduce((s, a) => s + a.amount, 0);

/** '11:00:00' → minutes since midnight. */
export const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
};

/** Do two bookings on the same day overlap in time? */
export function overlaps(a: { start_time: string; duration_minutes: number }, b: { start_time: string; duration_minutes: number }): boolean {
  const as = minutesOf(a.start_time);
  const bs = minutesOf(b.start_time);
  return as < bs + b.duration_minutes && bs < as + a.duration_minutes;
}
