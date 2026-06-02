using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace diplom_1.Migrations
{
    /// <inheritdoc />
    public partial class AddRequestDictionaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Comments_CommentId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Requests_RequestId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Modules_Products_ProductId",
                table: "Modules");

            migrationBuilder.CreateTable(
                name: "RequestPriorities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestPriorities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RequestStatuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestStatuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RequestTopics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RequestTopics", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "RequestPriorities",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Низкий" },
                    { 2, "Средний" },
                    { 3, "Высокий" },
                    { 4, "Критический" }
                });

            migrationBuilder.InsertData(
                table: "RequestStatuses",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Создана" },
                    { 2, "В работе" },
                    { 3, "Завершена" },
                    { 4, "Отменена" }
                });

            migrationBuilder.InsertData(
                table: "RequestTopics",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Техническая проблема" },
                    { 2, "Консультация" },
                    { 3, "Настройка" },
                    { 4, "Доработка" },
                    { 5, "Другое" }
                });

            migrationBuilder.Sql(@"
                SELECT setval(
                    pg_get_serial_sequence('""RequestPriorities""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""RequestPriorities""), 1)
                );
            ");

            migrationBuilder.Sql(@"
                SELECT setval(
                    pg_get_serial_sequence('""RequestStatuses""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""RequestStatuses""), 1)
                );
            ");

            migrationBuilder.Sql(@"
                SELECT setval(
                    pg_get_serial_sequence('""RequestTopics""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""RequestTopics""), 1)
                );
            ");

            migrationBuilder.AddColumn<int>(
                name: "ChangedById",
                table: "RequestStatusHistories",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequestStatusId",
                table: "RequestStatusHistories",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "RequestPriorityId",
                table: "Requests",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<int>(
                name: "RequestStatusId",
                table: "Requests",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "RequestTopicId",
                table: "Requests",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.Sql(@"
                INSERT INTO ""RequestTopics"" (""Name"")
                SELECT DISTINCT LEFT(COALESCE(NULLIF(TRIM(""Topic""), ''), 'Другое'), 150)
                FROM ""Requests""
                WHERE ""Topic"" IS NOT NULL
                  AND TRIM(""Topic"") <> ''
                  AND NOT EXISTS (
                      SELECT 1
                      FROM ""RequestTopics"" rt
                      WHERE rt.""Name"" = LEFT(COALESCE(NULLIF(TRIM(""Requests"".""Topic""), ''), 'Другое'), 150)
                  );
            ");

            migrationBuilder.Sql(@"
                SELECT setval(
                    pg_get_serial_sequence('""RequestTopics""', 'Id'),
                    COALESCE((SELECT MAX(""Id"") FROM ""RequestTopics""), 1)
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE ""Requests""
                SET ""RequestTopicId"" = COALESCE(
                    (
                        SELECT rt.""Id""
                        FROM ""RequestTopics"" rt
                        WHERE rt.""Name"" = LEFT(COALESCE(NULLIF(TRIM(""Requests"".""Topic""), ''), 'Другое'), 150)
                        LIMIT 1
                    ),
                    5
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE ""Requests""
                SET ""RequestPriorityId"" =
                    CASE COALESCE(NULLIF(TRIM(""Priority""), ''), 'Средний')
                        WHEN 'Низкий' THEN 1
                        WHEN 'Средний' THEN 2
                        WHEN 'Высокий' THEN 3
                        WHEN 'Критический' THEN 4
                        ELSE 2
                    END;
            ");

            migrationBuilder.Sql(@"
                UPDATE ""Requests""
                SET ""RequestStatusId"" =
                    CASE COALESCE(NULLIF(TRIM(""Status""), ''), 'Создана')
                        WHEN 'Создана' THEN 1
                        WHEN 'В работе' THEN 2
                        WHEN 'Завершена' THEN 3
                        WHEN 'Отменена' THEN 4
                        ELSE 1
                    END;
            ");

            migrationBuilder.Sql(@"
                UPDATE ""RequestStatusHistories""
                SET ""RequestStatusId"" =
                    CASE COALESCE(NULLIF(TRIM(""Status""), ''), 'Создана')
                        WHEN 'Создана' THEN 1
                        WHEN 'В работе' THEN 2
                        WHEN 'Завершена' THEN 3
                        WHEN 'Отменена' THEN 4
                        ELSE 1
                    END;
            ");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "RequestStatusHistories");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "Topic",
                table: "Requests");

            migrationBuilder.CreateIndex(
                name: "IX_RequestStatusHistories_ChangedById",
                table: "RequestStatusHistories",
                column: "ChangedById");

            migrationBuilder.CreateIndex(
                name: "IX_RequestStatusHistories_RequestStatusId",
                table: "RequestStatusHistories",
                column: "RequestStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_RequestPriorityId",
                table: "Requests",
                column: "RequestPriorityId");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_RequestStatusId",
                table: "Requests",
                column: "RequestStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_Requests_RequestTopicId",
                table: "Requests",
                column: "RequestTopicId");

            migrationBuilder.CreateIndex(
                name: "IX_RequestPriorities_Name",
                table: "RequestPriorities",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RequestStatuses_Name",
                table: "RequestStatuses",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RequestTopics_Name",
                table: "RequestTopics",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Comments_CommentId",
                table: "Attachments",
                column: "CommentId",
                principalTable: "Comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Requests_RequestId",
                table: "Attachments",
                column: "RequestId",
                principalTable: "Requests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Modules_Products_ProductId",
                table: "Modules",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_RequestPriorities_RequestPriorityId",
                table: "Requests",
                column: "RequestPriorityId",
                principalTable: "RequestPriorities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_RequestStatuses_RequestStatusId",
                table: "Requests",
                column: "RequestStatusId",
                principalTable: "RequestStatuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Requests_RequestTopics_RequestTopicId",
                table: "Requests",
                column: "RequestTopicId",
                principalTable: "RequestTopics",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RequestStatusHistories_RequestStatuses_RequestStatusId",
                table: "RequestStatusHistories",
                column: "RequestStatusId",
                principalTable: "RequestStatuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RequestStatusHistories_Users_ChangedById",
                table: "RequestStatusHistories",
                column: "ChangedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Comments_CommentId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Attachments_Requests_RequestId",
                table: "Attachments");

            migrationBuilder.DropForeignKey(
                name: "FK_Modules_Products_ProductId",
                table: "Modules");

            migrationBuilder.DropForeignKey(
                name: "FK_Requests_RequestPriorities_RequestPriorityId",
                table: "Requests");

            migrationBuilder.DropForeignKey(
                name: "FK_Requests_RequestStatuses_RequestStatusId",
                table: "Requests");

            migrationBuilder.DropForeignKey(
                name: "FK_Requests_RequestTopics_RequestTopicId",
                table: "Requests");

            migrationBuilder.DropForeignKey(
                name: "FK_RequestStatusHistories_RequestStatuses_RequestStatusId",
                table: "RequestStatusHistories");

            migrationBuilder.DropForeignKey(
                name: "FK_RequestStatusHistories_Users_ChangedById",
                table: "RequestStatusHistories");

            migrationBuilder.DropTable(
                name: "RequestPriorities");

            migrationBuilder.DropTable(
                name: "RequestStatuses");

            migrationBuilder.DropTable(
                name: "RequestTopics");

            migrationBuilder.DropIndex(
                name: "IX_RequestStatusHistories_ChangedById",
                table: "RequestStatusHistories");

            migrationBuilder.DropIndex(
                name: "IX_RequestStatusHistories_RequestStatusId",
                table: "RequestStatusHistories");

            migrationBuilder.DropIndex(
                name: "IX_Requests_RequestPriorityId",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_RequestStatusId",
                table: "Requests");

            migrationBuilder.DropIndex(
                name: "IX_Requests_RequestTopicId",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "ChangedById",
                table: "RequestStatusHistories");

            migrationBuilder.DropColumn(
                name: "RequestStatusId",
                table: "RequestStatusHistories");

            migrationBuilder.DropColumn(
                name: "RequestPriorityId",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "RequestStatusId",
                table: "Requests");

            migrationBuilder.DropColumn(
                name: "RequestTopicId",
                table: "Requests");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "RequestStatusHistories",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "Requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Topic",
                table: "Requests",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Comments_CommentId",
                table: "Attachments",
                column: "CommentId",
                principalTable: "Comments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Attachments_Requests_RequestId",
                table: "Attachments",
                column: "RequestId",
                principalTable: "Requests",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Modules_Products_ProductId",
                table: "Modules",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id");
        }
    }
}