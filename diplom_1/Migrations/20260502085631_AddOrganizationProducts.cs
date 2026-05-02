using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace diplom_1.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizationProducts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // УДАЛЕНА строка AddColumn<bool> для IsSuperAdmin

            migrationBuilder.CreateTable(
                name: "OrganizationProducts",
                columns: table => new
                {
                    OrganizationId = table.Column<int>(type: "integer", nullable: false),
                    ProductId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationProducts", x => new { x.OrganizationId, x.ProductId });
                    table.ForeignKey(
                        name: "FK_OrganizationProducts_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationProducts_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationProducts_ProductId",
                table: "OrganizationProducts",
                column: "ProductId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationProducts");

            // УДАЛЕНА строка DropColumn для IsSuperAdmin
        }
    }
}