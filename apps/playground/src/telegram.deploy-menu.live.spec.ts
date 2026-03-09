import { Controller, Module } from '@nestjs/common';
import { Context } from 'telegraf';
import { TelegramModule, MenuService, MenuAction, TgCommand } from '../../../libs/nest-teleforge/src';
import {
  callBotApi,
  clickInlineButtonByText,
  createLiveBotHarness,
  disposeLiveBotHarness,
  getRequiredLiveEnv,
  LiveBotHarness,
  LiveEnv,
  sendLiveMessage,
  TgUser,
  waitForTargetReplyInChat,
} from '../../../test/utils/telegram-live';

const TELEGRAM_DEPLOY_FLOW_ID = 'telegram_deploy';
const DeployMenuRoot = () => {};

@Controller()
export class TelegramDeployController {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand('startdeploy')
  async onStartDeploy(ctx: Context) {
    await this.menuService.start(
      ctx,
      {
        flowId: TELEGRAM_DEPLOY_FLOW_ID,
        text: 'Deploy requested from Service',
        columns: 2,
        mode: 'replace',
        reuseCurrentMessage: false,
        parentFunction: DeployMenuRoot,
      },
    );
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, 'deploy', {
    label: 'Deploy',
    description: 'Needs confirmation',
    columns: 2,
    parentFunction: DeployMenuRoot,
  })
  onDeploy(this: void): 'rerender' {
    return 'rerender';
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, 'cancel', {
    label: 'Cancel',
    parentFunction: DeployMenuRoot,
  })
  async onCancel(ctx: Context): Promise<'handled'> {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.answerCbQuery('Deploy canceled!');
    await ctx.reply('Target canceled');
    return 'handled';
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, 'confirm', {
    parentFunction: TelegramDeployController.prototype.onDeploy,
    label: 'Confirm ✅',
  })
  async onConfirm(ctx: Context): Promise<'handled'> {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.answerCbQuery('Deploy confirmed!');
    await ctx.reply('Target deployed');
    return 'handled';
  }
}

@Module({
  imports: [
    TelegramModule.forRootAsync({
      useFactory: () => process.env.TELEGRAM_KEY!,
    }),
  ],
  controllers: [TelegramDeployController],
})
export class CustomDeployModule {}

describe('Telegram menu custom root menu integration', () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env: LiveEnv;
  let targetBotUsername = '';

  beforeAll(async () => {
    env = getRequiredLiveEnv();
    process.env.TELEGRAM_KEY = env.targetToken;

    const me = await callBotApi<TgUser>(env.targetToken, 'getMe');
    if (!me.username) throw new Error('Target bot must have username');
    targetBotUsername = me.username;

    harness = await createLiveBotHarness(CustomDeployModule, env.targetToken);
  });

  afterAll(async () => {
    await disposeLiveBotHarness(harness);
  });

  it('handles isolated service-initiated root menu', async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: '/startdeploy' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Deploy requested from Service',
      sinceMs: startMs,
    });

    // 1st level: click Deploy
    await clickInlineButtonByText({ env, buttonText: 'Deploy' });

    // 2nd level: click Confirm
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Needs confirmation',
    });

    await clickInlineButtonByText({ env, buttonText: 'Confirm ✅' });

    // Check confirmation text
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Target deployed',
    });
  });
});
