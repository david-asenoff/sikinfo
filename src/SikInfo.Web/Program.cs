// Помощник за СИК - сайтът.
//
// Приложението само раздава статични файлове от wwwroot: страниците на помощника
// (пътеводител, проверка на протокол, въпроси), скриптовете и данните им, стиловете
// и папките на изборите с Word и Excel двойките за удостоверенията. Цялата логика е
// в браузъра; тук няма страници със сървърен код, няма форми, няма база данни.
// ASP.NET Core е само начинът на публикуване и хостване (IIS + Kestrel, OutOfProcess).

using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHsts(options => options.MaxAge = TimeSpan.FromDays(365));
builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    // Старият адрес и вариантът с www препращат за постоянно към sikinfo.com, със същата
    // страница и с един скок направо към https. Пази връзките от видеото и от писмата.
    app.Use(async (context, next) =>
    {
        var host = context.Request.Host.Host;
        var isOldOrWww = host.Equals("udostoverenia-sik.com", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".udostoverenia-sik.com", StringComparison.OrdinalIgnoreCase)
            || host.Equals("www.sikinfo.com", StringComparison.OrdinalIgnoreCase);
        if (isOldOrWww)
        {
            context.Response.Redirect("https://sikinfo.com" + context.Request.Path + context.Request.QueryString, permanent: true);
            return;
        }
        await next();
    });

    app.UseHsts();
    app.UseHttpsRedirection();
}

// Заглавки за сигурност на всеки отговор. Разрешени са само собствените стилове и скриптове
// (помощникът за СИК и подписът на автора), иконата и вграденото видео от YouTube.
// Подписът рисува стиловете си като вграден <style> в shadow root; хешът по-долу е на точно
// този блок (wwwroot/js/made-by-david.js, масивът STYLE). Ако файлът се смени, хешът се
// преизчислява: в конзолата на браузъра
//   const t = document.querySelector('made-by-david').shadowRoot.querySelector('style').textContent;
//   btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))))
const string signatureStyleHash = "'sha256-SrgF+LPnNcsHz3Qy+hlRwb1M6TgR3iPaXYw9sdXCEnU='";
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    // Единствената външна връзка на страниците е анонимната статистика за посещенията (Umami):
    // скриптът се зарежда от cloud.umami.is и праща само към gateway.umami.is. Към друг адрес
    // страниците не могат да изпращат нищо. Скриптът за работа без интернет (sw.js) може да
    // тегли само страниците на самия сайт, за да ги пази в кеша.
    var isServiceWorker = context.Request.Path.Equals("/sw.js", StringComparison.OrdinalIgnoreCase);
    headers["Content-Security-Policy"] = isServiceWorker
        ? "default-src 'none'; connect-src 'self'"
        : "default-src 'none'; script-src 'self' https://cloud.umami.is; connect-src https://gateway.umami.is; " +
          "worker-src 'self'; style-src 'self' " + signatureStyleHash + "; img-src 'self' data:; " +
          "frame-src https://www.youtube-nocookie.com; " +
          "form-action 'none'; base-uri 'none'; frame-ancestors 'none'";
    headers["X-Content-Type-Options"] = "nosniff";
    // YouTube иска Referer (само адресът на сайта, без път), иначе плеърът дава грешка 153.
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=(), interest-cohort=()";
    await next();
});

// Файловете на изборите са свързани в проекта (Link в .csproj) и при build попадат в
// bin/.../wwwroot. При dotnet run сайтът раздава и оттам; след publish двете папки съвпадат.
var buildWwwroot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
var files = Directory.Exists(buildWwwroot)
    ? new CompositeFileProvider(app.Environment.WebRootFileProvider, new PhysicalFileProvider(buildWwwroot))
    : app.Environment.WebRootFileProvider;

var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".md"] = "text/markdown; charset=utf-8";
contentTypes.Mappings[".zip"] = "application/zip";

app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = files,
    ContentTypeProvider = contentTypes,
    OnPrepareResponse = ctx =>
    {
        // Страниците, стиловете и скриптовете се проверяват при всяко отваряне, за да се вижда
        // веднага всяка поправка в съдържанието; файловете за изтегляне - кеш един ден.
        var name = ctx.File.Name;
        var isLive = name.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
                  || name.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
                  || name.EndsWith(".css", StringComparison.OrdinalIgnoreCase);
        ctx.Context.Response.Headers.CacheControl = isLive ? "no-cache" : "public, max-age=86400";
    }
});

app.Run();
