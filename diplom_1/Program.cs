using diplom_1.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------
// 1️⃣ Подключение к БД (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---------------------------------------
// 2️⃣ Razor Pages
builder.Services.AddRazorPages();

// ---------------------------------------
// 3️⃣ HttpContextAccessor (для доступа к сессии из моделей и сервисов)
builder.Services.AddHttpContextAccessor();

// ---------------------------------------
// 4️⃣ Настройка сессий
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; // <— исправлено
});


// ---------------------------------------
// 5️⃣ Добавим базовую аутентификацию/авторизацию (даже если не используешь Identity)
builder.Services.AddAuthentication();
builder.Services.AddAuthorization();

var app = builder.Build();

// ---------------------------------------
// 6️⃣ Конфигурация middleware

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// ✅ Сначала — аутентификация и авторизация
app.UseAuthentication();
app.UseAuthorization();

// ✅ Потом — включаем сессии
app.UseSession();

// ✅ Подключаем Razor Pages
app.MapRazorPages();

// ✅ Корректный редирект на страницу логина
app.MapGet("/", context =>
{
    context.Response.Redirect("/Login");
    return Task.CompletedTask;
});

app.Run();
