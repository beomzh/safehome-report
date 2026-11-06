/**
 * 금액 × 비율(%) 을 원 단위 정수로 계산한다 (내림). BigInt 로 계산해 부동소수점 오차와
 * safe integer 초과를 피한다 (ADR-0004). 비율은 소수 넷째 자리(0.0001%)까지 반영한다.
 */
export function mulPercent(won: number, percent: number): number {
  if (!Number.isSafeInteger(won) || won < 0) throw new RangeError(`금액은 0 이상의 정수여야 한다: ${won}`);
  if (!Number.isFinite(percent) || percent < 0) throw new RangeError(`비율은 0 이상이어야 한다: ${percent}`);
  const basisPoints = BigInt(Math.round(percent * 10_000));
  const result = Number((BigInt(won) * basisPoints) / 1_000_000n);
  if (!Number.isSafeInteger(result)) throw new RangeError('계산 결과가 정수 범위를 벗어났다');
  return result;
}

/** 원리금균등 상환 시 월 상환액(원, 올림). 연이율 0% 이면 원금 균등 분할 */
export function monthlyPayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (principal <= 0) return 0;
  const r = annualRatePercent / 1200;
  if (r === 0) return Math.ceil(principal / termMonths);
  return Math.ceil((principal * r) / (1 - Math.pow(1 + r, -termMonths)));
}

/** 연간 상환 가능액으로 감당 가능한 대출 원금(원, 내림). monthlyPayment 의 역산 */
export function principalFromAnnualPayment(
  annualPayment: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (annualPayment <= 0) return 0;
  const monthly = annualPayment / 12;
  const r = annualRatePercent / 1200;
  const principal = r === 0 ? monthly * termMonths : (monthly * (1 - Math.pow(1 + r, -termMonths))) / r;
  const floored = Math.floor(principal);
  if (!Number.isSafeInteger(floored)) throw new RangeError('계산 결과가 정수 범위를 벗어났다');
  return Math.max(0, floored);
}
