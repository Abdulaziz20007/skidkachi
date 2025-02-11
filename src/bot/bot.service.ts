import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Bot } from "./models/bot.model";
import { InjectBot } from "nestjs-telegraf";
import { BOT_NAME } from "../app.constants";
import { Context, Markup, Telegraf } from "telegraf";
import { Address } from "./models/address.model";
import { Car } from "./models/car.model";

@Injectable()
export class BotService {
  constructor(
    @InjectModel(Bot) private readonly botModel: typeof Bot,
    @InjectModel(Address) private readonly addressModel: typeof Address,
    @InjectModel(Car) private readonly carModel: typeof Car,
    @InjectBot(BOT_NAME) private readonly bot: Telegraf<Context>
  ) {}

  async start(ctx: Context) {
    console.log("A");

    const user_id = ctx.from!.id;
    const user = await this.botModel.findByPk(user_id);
    if (!user) {
      await this.botModel.create({
        user_id,
        username: ctx.from?.username,
        first_name: ctx.from?.first_name,
        last_name: ctx.from?.last_name,
        lang: ctx.from?.language_code,
      });
      await ctx.reply(
        `Iltimos, <b>📱Telefon raqamni yuborish</b> tugmasini bosing`,
        {
          parse_mode: "HTML",
          ...Markup.keyboard([
            [Markup.button.contactRequest("📱Telefon raqamni yuborish")],
          ])
            .resize()
            .oneTime(),
        }
      );
    } else if (!user.status) {
      await ctx.reply(
        `Iltimos, <b>📱Telefon raqamni yuborish</b> tugmasini bosing`,
        {
          parse_mode: "HTML",
          ...Markup.keyboard([
            [Markup.button.contactRequest("📱Telefon raqamni yuborish")],
          ])
            .resize()
            .oneTime(),
        }
      );
    } else {
      await this.bot.telegram.sendChatAction(user_id!, "record_video");
      await ctx.reply(
        `Ushbu bot Skidkachi foydalanuvchilarini faollashtirish uchun`,
        {
          parse_mode: "HTML",
          ...Markup.removeKeyboard(),
        }
      );
    }
  }

  async onContact(ctx: Context) {
    if ("contact" in ctx.message!) {
      const user_id = ctx.from!.id;
      const user = await this.botModel.findByPk(user_id);
      if (!user) {
        await ctx.reply(`Iltimos, <b>Start</b> tugmasini bosing`, {
          parse_mode: "HTML",
          ...Markup.keyboard([["/start"]])
            .resize()
            .oneTime(),
        });
      } else if (ctx.message?.contact.user_id != user_id) {
        await ctx.reply(
          `Iltimos, <b>📱Telefon raqamni yuborish</b> tugmasini bosing`,
          {
            parse_mode: "HTML",
            ...Markup.keyboard([
              [Markup.button.contactRequest("📱Telefon raqamni yuborish")],
            ])
              .resize()
              .oneTime(),
          }
        );
      } else {
        user.phone_number = ctx.message.contact.phone_number;
        user.status = true;
        await user.save();
        await ctx.reply(`Tabriklayman, sizning hisobingiz faollashtirildi!`, {
          parse_mode: "HTML",
          ...Markup.removeKeyboard(),
        });
      }
    }
  }

  async onStop(ctx: Context) {
    try {
      const user_id = ctx.from?.id;
      const user = await this.botModel.findByPk(user_id);

      if (user && user.status) {
        user.status = false;
        user.phone_number = "";
        await user.save();
        await ctx.reply(
          `Ketayotganing yaxshi bo'ldi, chatda havo tiniqlashadi. Ammo baribir ortga qaytasan, chunki seniz bu yer zerikarli. Ko'rishguncha, sharmandalar qiroli! 👋😂`,
          {
            parse_mode: "HTML",
            ...Markup.removeKeyboard(),
          }
        );
      }
    } catch (err) {
      console.log("OnStop error: ", err);
    }
  }

  async onLocation(ctx: Context) {
    try {
      if ("location" in ctx.message!) {
        const user_id = ctx.from?.id;
        const user = await this.botModel.findByPk(user_id);
        if (!user || !user.status) {
          await ctx.reply(`Siz avval ro'yxatdan o'tishni yakunlang`, {
            parse_mode: "HTML",
            ...Markup.keyboard([["/start"]]).resize(),
          });
        } else {
          const address = await this.addressModel.findOne({
            where: { user_id },
            order: [["id", "DESC"]],
          });
          if (address && address.last_state == "location") {
            address.location = `${ctx.message.location.latitude},${ctx.message.location.longitude}`;
            address.last_state = "finish";
            await address.save();
            await ctx.reply("Manzil saqlandi!", {
              parse_mode: "HTML",
              ...Markup.keyboard([
                ["Mening manzillarim", "Yangi manzil qo'shish"],
              ]).resize(),
            });
          }
        }
      }
    } catch (err) {
      console.log("onLocation error:", err);
    }
  }

  async onText(ctx: Context) {
    try {
      if ("text" in ctx.message!) {
        const user_id = ctx.from?.id;
        const user = await this.botModel.findByPk(user_id);
        console.log(user?.action);

        if (!user || !user.status) {
          await ctx.reply(`⚠️ Siz avval ro'yxatdan o'tishni yakunlang`, {
            parse_mode: "HTML",
            ...Markup.keyboard([["/start"]]).resize(),
          });
        } else {
          if (user.action === "car") {
            const car = await this.carModel.findOne({
              where: { user_id },
              order: [["id", "DESC"]],
            });
            if (car?.last_state === "number") {
              const plateNumberRegex =
                /^(0[1-9]|1[0-9]|2[0-7])([A-Z]{1,2}\d{3}[A-Z]{2}|\d{3}[A-Z]{3})$/;
              if (!plateNumberRegex.test(ctx.message.text)) {
                await ctx.reply(
                  `❌ Noto'g'ri format! Iltimos, quyidagi formatda kiriting:\n\n` +
                    `<i>01A777AA</i> yoki <i>01777AAA</i>\n`,
                  {
                    parse_mode: "HTML",
                    ...Markup.removeKeyboard(),
                  }
                );
                return;
              }
              car.number = ctx.message.text;
              car.last_state = "model";
              await car.save();
              await ctx.reply(`🚗 Mashina modelini kiriting:`, {
                parse_mode: "HTML",
                ...Markup.removeKeyboard(),
              });
            } else if (car?.last_state === "model") {
              car.model = ctx.message.text;
              car.last_state = "color";
              await car.save();
              await ctx.reply(`🎨 Mashina rangini kiriting:`, {
                parse_mode: "HTML",
                ...Markup.removeKeyboard(),
              });
            } else if (car?.last_state === "color") {
              car.color = ctx.message.text;
              car.last_state = "year";
              await car.save();
              await ctx.reply(`📅 Mashina yilini kiriting:`, {
                parse_mode: "HTML",
                ...Markup.removeKeyboard(),
              });
            } else if (car?.last_state === "year") {
              const year = parseInt(ctx.message.text);
              if (isNaN(year)) {
                await ctx.reply(`❌ Iltimos, raqam kiriting:`, {
                  parse_mode: "HTML",
                  ...Markup.removeKeyboard(),
                });
                return;
              }
              car.year = year;
              car.last_state = "finish";
              await car.save();
              user.action = "";
              await user.save();
              await ctx.reply(`🚗 Mashina muvaffaqiyatli qo'shildi!`, {
                parse_mode: "HTML",
                ...Markup.keyboard([
                  ["🚗 Mening mashinalarim", "➕ Yangi mashina qo'shish"],
                ]).resize(),
              });
            }
          } else if (user.action === "editCarNumber") {
            const carId = user.temp;
            const car = await this.carModel.findByPk(carId);
            if (car) {
              const plateNumberRegex =
                /^(0[1-9]|1[0-9]|2[0-7])([A-Z]{1,2}\d{3}[A-Z]{2}|\d{3}[A-Z]{3})$/;
              if (!plateNumberRegex.test(ctx.message.text)) {
                await ctx.reply(
                  `❌ Noto'g'ri format! Iltimos, quyidagi formatda kiriting:\n\n` +
                    `<i>01 A777AA</i> yoki <i>01 777AAA</i>\n`,
                  {
                    parse_mode: "HTML",
                    ...Markup.removeKeyboard(),
                  }
                );
                return;
              }
              car.number = ctx.message.text;
              await car.save();
              user.action = "";
              user.temp = "";
              await user.save();
              await ctx.reply(
                `✅ Mashina raqami muvaffaqiyatli o'zgartirildi!`,
                {
                  parse_mode: "HTML",
                  ...Markup.keyboard([
                    ["🚗 Mening mashinalarim", "➕ Yangi mashina qo'shish"],
                  ]).resize(),
                }
              );
            }
          } else if (user.action === "editCarModel") {
            const carId = user.temp;
            const car = await this.carModel.findByPk(carId);
            if (car) {
              car.model = ctx.message.text;
              await car.save();
              user.action = "";
              user.temp = "";
              await user.save();
              await ctx.reply(
                `🚗 Mashina modeli muvaffaqiyatli o'zgartirildi!`,
                {
                  parse_mode: "HTML",
                  ...Markup.keyboard([
                    ["🚗 Mening mashinalarim", "➕ Yangi mashina qo'shish"],
                  ]).resize(),
                }
              );
            }
          } else if (user.action === "editCarColor") {
            const carId = user.temp;
            const car = await this.carModel.findByPk(carId);
            if (car) {
              car.color = ctx.message.text;
              await car.save();
              user.action = "";
              user.temp = "";
              await user.save();
              await ctx.reply(
                `🎨 Mashina rangi muvaffaqiyatli o'zgartirildi!`,
                {
                  parse_mode: "HTML",
                  ...Markup.keyboard([
                    ["🚗 Mening mashinalarim", "➕ Yangi mashina qo'shish"],
                  ]).resize(),
                }
              );
            }
          } else if (user.action === "editCarYear") {
            const carId = user.temp;
            const car = await this.carModel.findByPk(carId);
            if (car) {
              const year = parseInt(ctx.message.text);
              if (isNaN(year)) {
                await ctx.reply(`Iltimos, raqam kiriting:`, {
                  parse_mode: "HTML",
                  ...Markup.removeKeyboard(),
                });
                return;
              }
              car.year = year;
              await car.save();
              user.action = "";
              user.temp = "";
              await user.save();
              await ctx.reply(`📅 Mashina yili muvaffaqiyatli o'zgartirildi!`, {
                parse_mode: "HTML",
                ...Markup.keyboard([
                  ["🚗 Mening mashinalarim", "➕ Yangi mashina qo'shish"],
                ]).resize(),
              });
            }
          } else {
            const address = await this.addressModel.findOne({
              where: { user_id },
              order: [["id", "DESC"]],
            });
            if (address!.last_state == "name") {
              address!.name = ctx.message.text;
              address!.last_state = "address";
              await address!.save();
              await ctx.reply(`Manzilingizni kiriting`, {
                parse_mode: "HTML",
                ...Markup.removeKeyboard(),
              });
            } else if (address!.last_state == "address") {
              address!.address = ctx.message.text;
              address!.last_state = "location";

              await address!.save();
              await ctx.reply(`Manzilingiz lokatsiyasini yuboring`, {
                parse_mode: "HTML",
                ...Markup.keyboard([
                  [Markup.button.locationRequest("📍 Lokatsiya yuborish")],
                ]).resize(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.log("onText error:", err);
    }
  }

  async deleteUncaughtMessage(ctx: Context) {
    try {
      const messageId = ctx.message?.message_id;
      await ctx.deleteMessage(messageId);
    } catch (err) {}
  }

  async sendOtp(
    phone_number: string,
    OTP: string
  ): Promise<boolean | undefined> {
    try {
      const user = await this.botModel.findOne({ where: { phone_number } });
      if (!user || !user.status) {
        return false;
      } else {
        await this.bot.telegram.sendMessage(
          user.user_id,
          `Verification OTP code: ${OTP}`
        );
        return true;
      }
      return false;
    } catch (err) {
      console.log(err);
    }
  }
}
