export function millisecondsToHoursMinutes(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      const seconds = Math.floor((milliseconds % 60000) / 1000);
      return `${minutes}min ${seconds}sec`;
    } else {
      return `${hours}hr ${minutes}min`;
    }
  }

export function millisecondsToMinutes(milliseconds){
  return milliseconds/60000;
}