// 0x00464750 divides by the second value; zero raises a divide error in the original.
export class TimerDivideByZeroError extends Error {
  constructor() {
    super('A randomised timer value of 0 divides by zero')
    this.name = 'TimerDivideByZeroError'
  }
}
