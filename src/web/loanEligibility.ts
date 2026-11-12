import eligibilityJson from '../../rules.config/loan-eligibility.json';
import { eligibilitySchema } from '../core/loanRecommend';

/** 정책 대출 대상 요건 데이터(공식 안내 페이지 기준, 확인일 포함). 형식이 틀리면 시작 시점에 오류가 난다 */
export const LOAN_ELIGIBILITY = eligibilitySchema.parse(eligibilityJson);
