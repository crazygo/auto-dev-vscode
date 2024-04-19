import { injectable } from "inversify";

import { ChatContextItem, ChatContextProvider, ChatCreationContext } from "../ChatContextProvider";
import { GradleTooling } from "../tooling/GradleTooling";

@injectable()
export class JavaSdkVersionProvider implements ChatContextProvider {
	name = "JavaSdkVersionProvider";

	isApplicable(context: ChatCreationContext): boolean {
		return context.language === "java";
	}

	async collect(context: ChatCreationContext): Promise<ChatContextItem[]> {
		let gradleInfo ;
		try {
			gradleInfo = await GradleTooling.instance().getGradleVersion();
		} catch (e) {
			console.error(e);
			return [];
		}

		if (gradleInfo) {
			return [
				{
					clazz: JavaSdkVersionProvider.name,
					text: `You are using Java SDK version ${gradleInfo.jvmVersion}.`
				}
			];
		}

		return [];
	}
}