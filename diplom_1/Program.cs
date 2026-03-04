using diplom_1.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------
// 1️⃣ Подключение к БД (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---------------------------------------
// 2️⃣ Razor Pages
builder.Services.AddRazorPages();

// ---------------------------------------
// 3️⃣ HttpContextAccessor
builder.Services.AddHttpContextAccessor();

// ---------------------------------------
// 4️⃣ Настройка AntiForgery
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
    options.FormFieldName = "__RequestVerificationToken";
});

// ---------------------------------------
// 5️⃣ Настройка сессий
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// ---------------------------------------
// 6️⃣ Базовая аутентификация/авторизация
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

// ---------------------------------------
// 7️⃣ НАСТРОЙКА ЛОГИРОВАНИЯ (ДОБАВЬТЕ ЭТО!)
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Logging.AddDebug();
builder.Logging.SetMinimumLevel(LogLevel.Information);

var app = builder.Build();

// ---------------------------------------
// 8️⃣ Конфигурация middleware

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseSession();

app.MapRazorPages();

app.MapGet("/", context =>
{
    context.Response.Redirect("/Login");
    return Task.CompletedTask;
});

app.Run();