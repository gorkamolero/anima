import { CharacterMotor, type MotorPlanRequest } from "./CharacterMotor";

self.onmessage = (event: MessageEvent<MotorPlanRequest>) => {
	self.postMessage(CharacterMotor.computePlan(event.data));
};
